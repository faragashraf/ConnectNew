using Core;
using ENPO.CreateLogFile;
using ENPO.CustomSwagger;
using ENPO.Dto.Utilities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
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
using Persistence.UnitOfWorks;
using SignalR.Notification;
using System.Reflection;
using System.Text;

// Ensure Oracle client sessions use UTF-8 on hosts that do not have NLS_LANG configured.
const string oracleNlsLang = "AMERICAN_AMERICA.AL32UTF8";
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("NLS_LANG")))
{
    Environment.SetEnvironmentVariable("NLS_LANG", oracleNlsLang);
}

string AllowAllCors = "AllowAll";
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers(options =>
{
    options.Filters.Add(new AuthorizeFilter()); //Authorize All Controllers
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
//builder.Services.Configure<ApplicationConfig>(builder.Configuration.GetSection("ApplicationConfig"));

builder.Services.AddSingleton<ApplicationConfig>(sp =>
       sp.GetRequiredService<IOptions<ApplicationConfig>>().Value);

builder.Services.AddScoped<helperService>();
builder.Services.AddSingleton<ENPOCreateLogFile>(provider => new ENPOCreateLogFile("YourStringValue", "YourSecondStringValue", FileExtension.txt));

builder.Services.AddHttpContextAccessor();

// Bind the ApplicationConfig section manually
var applicationConfig = new ApplicationConfig();
builder.Configuration.GetSection(nameof(ApplicationConfig)).Bind(applicationConfig);

builder.Services.AddSingleton<SignalRConnectionManager>(sp =>
{
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();
    return new SignalRConnectionManager(
        applicationConfig.HubServerIP,
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
        ValidIssuer = applicationConfig.tokenOptions.Issuer,
        ValidAudience = applicationConfig.tokenOptions.Audience!,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(applicationConfig.tokenOptions.Key)),
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

//builder.Services.AddControllers().AddJsonOptions(opts =>
//{
//    opts.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
//});

builder.Services.AddControllers();
builder.Services.AddAutoMapper(typeof(MappingProfile));
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
           builder => builder.SetIsOriginAllowed(origin => true)
                             .AllowAnyHeader()
                             .AllowAnyMethod()
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

// Ensure pending EF Core migrations are applied for ConnectContext on startup (idempotent)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var connectContext = services.GetRequiredService<ConnectContext>();
        // Apply migrations if any pending. If already applied, this is a no-op.
        var configuration = services.GetService<Microsoft.Extensions.Configuration.IConfiguration>();
        var conn = configuration?.GetConnectionString("ConnectConnectingString");
        Console.WriteLine($"[StartupMigrations] Target connection: {conn}");

        var pending = connectContext.Database.GetPendingMigrations();
        var pendingList = pending?.ToList() ?? new System.Collections.Generic.List<string>();
        Console.WriteLine($"[StartupMigrations] Pending migrations: {(pendingList.Count > 0 ? string.Join(",", pendingList) : "<none>")}");

        connectContext.Database.Migrate();
        Console.WriteLine("[StartupMigrations] Database.Migrate() completed successfully.");
    }
    catch (Exception ex)
    {
        var loggerFactory = services.GetService<Microsoft.Extensions.Logging.ILoggerFactory>();
        var logger = loggerFactory?.CreateLogger("StartupMigrations");
        logger?.LogError(ex, "Error applying database migrations for ConnectContext.");
        throw;
    }
}

// Use the custom middleware
//app.UseMiddleware<RequestValidationMiddleware>();
app.UseCors("AllowAll");

app.UseRouting();

if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("../swagger/v1/swagger.json", "Template"));
}

app.UseAuthentication();

app.UseAuthorization();

var disableSignalRStartup = app.Configuration.GetValue<bool>("LocalDevelopment:DisableSignalRStartup");
if (!disableSignalRStartup)
{
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
}
else
{
    Console.WriteLine("[Startup] SignalR startup connection is disabled by LocalDevelopment:DisableSignalRStartup.");
}


app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});

app.MapControllers();
app.Run();
