using Core;
using Api.HostedServices;
using ENPO.CreateLogFile;
using ENPO.CustomSwagger;
using ENPO.Dto.Utilities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Models.AutoMapping;
using Models.DTO.Common;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.UnitOfWorks;
using SignalR.Notification;
using System.Data;
using System.Reflection;
using System.Text.Encodings.Web;
using System.Text;

string AllowAllCors = "AllowAll";
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers(options =>
{
    options.Filters.Add(new AuthorizeFilter()); //Authorize All Controllers
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle


builder.Services.AddDbContext<ConnectContext>(o =>
{
    o.UseSqlServer(
        builder.Configuration.GetConnectionString("ConnectConnectingString"),
        sql => sql.MigrationsAssembly(typeof(ConnectContext).Assembly.GetName().Name)
    );
}, ServiceLifetime.Transient);
builder.Services.AddDbContext<Attach_HeldContext>
    (o => o.UseSqlServer(builder.Configuration.GetConnectionString("HeldAttach")),
             ServiceLifetime.Transient);
builder.Services.AddDbContext<GPAContext>
             (options => options.UseOracle(builder.Configuration.GetConnectionString("OracleDBConnection")));


builder.Services.AddTransient<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

builder.Services.AddOptions<ApplicationConfig>().BindConfiguration(nameof(ApplicationConfig));
builder.Services.AddOptions<ResortBookingBlacklistOptions>().BindConfiguration(ResortBookingBlacklistOptions.SectionName);
//builder.Services.Configure<ApplicationConfig>(builder.Configuration.GetSection("ApplicationConfig"));

builder.Services.AddSingleton<ApplicationConfig>(sp =>
       sp.GetRequiredService<IOptions<ApplicationConfig>>().Value);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddScoped<helperService>();
builder.Services.AddScoped<SummerWorkflowService>();
builder.Services.AddScoped<IConnectNotificationService, ConnectNotificationService>();
builder.Services.AddHostedService<SummerPaymentAutoCancellationHostedService>();
builder.Services.AddSingleton<ENPOCreateLogFile>(provider => new ENPOCreateLogFile("YourStringValue", "YourSecondStringValue", FileExtension.txt));

builder.Services.AddHttpContextAccessor();

// Bind the ApplicationConfig section manually
var applicationConfig = new ApplicationConfig();
builder.Configuration.GetSection(nameof(ApplicationConfig)).Bind(applicationConfig);
var chatHubUrl = BuildAbsoluteUrl(
    builder.Configuration["AppUrls:PublicBaseUrl"],
    builder.Configuration["Routes:ChatHub"],
    "Routes:ChatHub");
Console.WriteLine($"[Startup] Resolved ChatHub URL: {chatHubUrl}");

builder.Services.AddSingleton<SignalRConnectionManager>(sp =>
{
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();
    return new SignalRConnectionManager(
        chatHubUrl,
        httpContextAccessor,
        applicationConfig.tokenOptions.Key, "App.Connect", "Connect", "Connect");
});



builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        ValidIssuer = applicationConfig.tokenOptions.Issuer,
        ValidAudience = applicationConfig.tokenOptions.Audience!,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(applicationConfig.tokenOptions.Key)),
    };

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            if (!context.Response.HasStarted)
            {
                context.Response.Headers["X-Auth-Error-Code"] =
                    context.Exception is SecurityTokenExpiredException ? "token_expired" : "token_invalid";
            }
            return Task.CompletedTask;
        },
        OnChallenge = context =>
        {
            if (!context.Response.HasStarted && !context.Response.Headers.ContainsKey("X-Auth-Error-Code"))
            {
                context.Response.Headers["X-Auth-Error-Code"] = "token_unauthorized";
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.Configure<FormOptions>(o =>
{
    o.ValueLengthLimit = int.MaxValue;
    o.MultipartBodyLengthLimit = int.MaxValue;
    o.MemoryBufferThreshold = int.MaxValue;
});
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(option =>
{
    option.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Connect API",
        Description = "\r\n \r\n \r\n<h1>  Important:<h1>\r\n \r\n \r\n <h3> ``This Swagger Is Running As``<h3> \r\n \r\n  \r\n<h1>Production<h1>",
        Version = "v1"
    });
    var allowedEndpoints = builder.Configuration.GetSection("swagger:allowedEndpoints").Get<string[]>();

    List<string> Allowed = new List<string>();
    if (allowedEndpoints != null)
        for (global::System.Int32 i = 0; i < allowedEndpoints.Length; i++)
        {
            var endpoint = allowedEndpoints[i];
            Allowed.Add(endpoint.Trim());
        }

    if (Allowed.Any())
        option.DocumentFilter<swaggerFilter>(Allowed, Assembly.GetExecutingAssembly());
    // Set the comments path for the Swagger JSON and UI.
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    option.IncludeXmlComments(xmlPath);

    option.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Please enter a valid token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "Bearer"
    });
    option.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type=ReferenceType.SecurityScheme,
                    Id="Bearer"
                }
            },
            new string[]{}
        }
    });
    // Replace enum values in Swagger with DescriptionAttribute text when present
    option.SchemaFilter<Api.CustomSwagger.EnumDescriptionSchemaFilter>();
});

builder.Services.AddAutoMapper(typeof(MappingProfile));
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
           builder => builder.SetIsOriginAllowed(origin => true)
                             .AllowAnyHeader()
                             .AllowAnyMethod()
                             .WithExposedHeaders("X-Auth-Error-Code")
                             .AllowCredentials()
                             );
});

builder.Services.AddHttpContextAccessor();

// Add RedisConnectionManager as a singleton service
builder.Services.AddSingleton<RedisConnectionManager>(serviceProvider =>
{
    var httpContextAccessor = serviceProvider.GetRequiredService<IHttpContextAccessor>();
    var appName = "Connect";
    var connectionString = builder.Configuration.GetConnectionString("RedisLogConnectionString");

    return new RedisConnectionManager(connectionString,appName, httpContextAccessor);
});


var app = builder.Build();

// Ensure pending EF Core migrations are applied for ConnectContext on startup (idempotent + safe for multi-instance startup).
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var loggerFactory = services.GetService<Microsoft.Extensions.Logging.ILoggerFactory>();
    var logger = loggerFactory?.CreateLogger("StartupMigrations");
    try
    {
        var connectContext = services.GetRequiredService<ConnectContext>();
        var configuration = services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
        var startupMigrationsEnabled = configuration.GetValue("StartupMigrations:Enabled", true);
        var failStartupOnError = configuration.GetValue("StartupMigrations:FailStartupOnError", true);
        var commandTimeoutSeconds = Math.Max(30, configuration.GetValue("StartupMigrations:CommandTimeoutSeconds", 300));
        var lockTimeoutSeconds = Math.Max(5, configuration.GetValue("StartupMigrations:SqlAppLockTimeoutSeconds", 120));
        var lockResource = (configuration.GetValue<string>("StartupMigrations:SqlAppLockResource") ?? "CONNECT_STARTUP_MIGRATIONS").Trim();
        if (string.IsNullOrWhiteSpace(lockResource))
        {
            lockResource = "CONNECT_STARTUP_MIGRATIONS";
        }

        if (!startupMigrationsEnabled)
        {
            logger?.LogInformation("Startup migrations are disabled by configuration.");
        }
        else
        {
            try
            {
                connectContext.Database.SetCommandTimeout(commandTimeoutSeconds);
                await EnsureConnectMigrationsAsync(
                    connectContext,
                    logger,
                    lockResource,
                    TimeSpan.FromSeconds(lockTimeoutSeconds),
                    CancellationToken.None);
            }
            catch (Exception migrationEx)
            {
                logger?.LogError(migrationEx, "Error applying database migrations for ConnectContext.");
                if (failStartupOnError)
                {
                    throw;
                }
            }
        }
    }
    catch (Exception ex)
    {
        logger?.LogError(ex, "Error applying database migrations for ConnectContext.");
        throw;
    }
}

// Use the custom middleware
//app.UseMiddleware<RequestValidationMiddleware>();
app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseCors(AllowAllCors);

app.UseRouting();

if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("../swagger/v1/swagger.json", "Template"));
}

app.UseAuthentication();

app.UseAuthorization();

// Start the SignalR connection
var signalRConnectionManager = app.Services.GetRequiredService<SignalRConnectionManager>();

// Register events for starting and stopping the SignalR connection
app.Lifetime.ApplicationStarted.Register(async () =>
{
    await signalRConnectionManager.StartConnectionAsync();
});

app.Lifetime.ApplicationStopping.Register(async () =>
{
    await signalRConnectionManager.StopConnectionAsync();
});


app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});

app.MapControllers();
app.Run();

static string BuildAbsoluteUrl(string? publicBaseUrl, string? routePath, string routePathConfigKey)
{
    if (string.IsNullOrWhiteSpace(publicBaseUrl))
    {
        throw new InvalidOperationException("AppUrls:PublicBaseUrl is required.");
    }

    if (!Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out var baseUri))
    {
        throw new InvalidOperationException($"AppUrls:PublicBaseUrl '{publicBaseUrl}' is not a valid absolute URL.");
    }

    if (!string.Equals(baseUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("AppUrls:PublicBaseUrl must use HTTPS.");
    }

    if (string.IsNullOrWhiteSpace(routePath))
    {
        throw new InvalidOperationException($"{routePathConfigKey} is required.");
    }

    var normalizedRoutePath = routePath.Trim();
    if (Uri.TryCreate(normalizedRoutePath, UriKind.Absolute, out var absoluteRouteUri)
        && (string.Equals(absoluteRouteUri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
            || string.Equals(absoluteRouteUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)))
    {
        return absoluteRouteUri.ToString();
    }

    normalizedRoutePath = normalizedRoutePath.Trim('/');
    if (normalizedRoutePath.Length == 0)
    {
        throw new InvalidOperationException($"{routePathConfigKey} is invalid.");
    }

    var basePath = baseUri.AbsolutePath.TrimEnd('/');
    var combinedPath = string.IsNullOrWhiteSpace(basePath) || basePath == "/"
        ? $"/{normalizedRoutePath}"
        : $"{basePath}/{normalizedRoutePath}";

    var builder = new UriBuilder(baseUri)
    {
        Path = combinedPath
    };

    return builder.Uri.ToString();
}

static async Task EnsureConnectMigrationsAsync(
    ConnectContext connectContext,
    Microsoft.Extensions.Logging.ILogger? logger,
    string lockResource,
    TimeSpan lockTimeout,
    CancellationToken cancellationToken)
{
    var database = connectContext.Database;
    var initialPending = database.GetPendingMigrations().ToList();
    logger?.LogInformation(
        "Startup migrations check: {PendingCount} pending migration(s).",
        initialPending.Count);

    if (initialPending.Count == 0)
    {
        return;
    }

    var useSqlServerLock = database.IsSqlServer();
    var lockAcquired = false;
    if (useSqlServerLock)
    {
        await database.OpenConnectionAsync(cancellationToken);
        lockAcquired = await TryAcquireStartupMigrationSqlLockAsync(
            connectContext,
            lockResource,
            Math.Max(5000, (int)lockTimeout.TotalMilliseconds),
            cancellationToken);

        if (!lockAcquired)
        {
            throw new InvalidOperationException(
                $"Could not acquire startup migration SQL lock '{lockResource}' within {lockTimeout.TotalSeconds} seconds.");
        }
    }

    try
    {
        var pendingAfterLock = database.GetPendingMigrations().ToList();
        if (pendingAfterLock.Count == 0)
        {
            logger?.LogInformation("Startup migrations: no pending migrations after lock acquisition.");
            return;
        }

        logger?.LogInformation(
            "Applying pending migrations: {Migrations}",
            string.Join(", ", pendingAfterLock));

        await database.MigrateAsync(cancellationToken);

        var remainingPending = database.GetPendingMigrations().ToList();
        if (remainingPending.Count > 0)
        {
            throw new InvalidOperationException(
                $"Startup migrations finished with remaining pending migrations: {string.Join(", ", remainingPending)}");
        }

        logger?.LogInformation("Startup migrations completed successfully.");
    }
    finally
    {
        if (useSqlServerLock && lockAcquired)
        {
            try
            {
                await ReleaseStartupMigrationSqlLockAsync(connectContext, lockResource, cancellationToken);
            }
            catch (Exception exRelease)
            {
                logger?.LogWarning(exRelease, "Failed to release startup migration SQL lock '{LockResource}'.", lockResource);
            }
        }

        if (useSqlServerLock)
        {
            await database.CloseConnectionAsync();
        }
    }
}

static async Task<bool> TryAcquireStartupMigrationSqlLockAsync(
    ConnectContext connectContext,
    string lockResource,
    int timeoutMs,
    CancellationToken cancellationToken)
{
    var connection = connectContext.Database.GetDbConnection();
    await using var command = connection.CreateCommand();
    command.CommandText = @"
DECLARE @result int;
EXEC @result = sp_getapplock
    @Resource = @resource,
    @LockMode = 'Exclusive',
    @LockOwner = 'Session',
    @LockTimeout = @timeout;
SELECT @result;";

    var resourceParam = command.CreateParameter();
    resourceParam.ParameterName = "@resource";
    resourceParam.Value = lockResource;
    command.Parameters.Add(resourceParam);

    var timeoutParam = command.CreateParameter();
    timeoutParam.ParameterName = "@timeout";
    timeoutParam.Value = timeoutMs;
    command.Parameters.Add(timeoutParam);

    var resultObject = await command.ExecuteScalarAsync(cancellationToken);
    var resultCode = Convert.ToInt32(resultObject ?? -999);
    return resultCode >= 0;
}

static async Task ReleaseStartupMigrationSqlLockAsync(
    ConnectContext connectContext,
    string lockResource,
    CancellationToken cancellationToken)
{
    var connection = connectContext.Database.GetDbConnection();
    await using var command = connection.CreateCommand();
    command.CommandText = @"
DECLARE @result int;
EXEC @result = sp_releaseapplock
    @Resource = @resource,
    @LockOwner = 'Session';
SELECT @result;";

    var resourceParam = command.CreateParameter();
    resourceParam.ParameterName = "@resource";
    resourceParam.Value = lockResource;
    command.Parameters.Add(resourceParam);

    await command.ExecuteScalarAsync(cancellationToken);
}
