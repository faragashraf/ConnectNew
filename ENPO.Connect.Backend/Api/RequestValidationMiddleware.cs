namespace Api
{
    public class RequestValidationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestValidationMiddleware> _logger;

        public RequestValidationMiddleware(RequestDelegate next, ILogger<RequestValidationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Read the request details
            var request = context.Request;

            // Log request method and path
            _logger.LogInformation("Request Method: {Method}", request.Method);
            _logger.LogInformation("Request Path: {Path}", request.Path);

            // Log request headers
            foreach (var header in request.Headers)
            {
                _logger.LogInformation("Header: {Key} = {Value}", header.Key, header.Value);
            }

            // Log request query parameters
            foreach (var queryParam in request.Query)
            {
                _logger.LogInformation("Query Parameter: {Key} = {Value}", queryParam.Key, queryParam.Value);
            }

            // Log request body if it's a POST or PUT request
            if (request.Method == HttpMethods.Post || request.Method == HttpMethods.Put)
            {
                request.EnableBuffering();
                var body = await new StreamReader(request.Body).ReadToEndAsync();
                _logger.LogInformation("Request Body: {Body}", body);
                request.Body.Position = 0;
            }

            // Call the next middleware in the pipeline
            await _next(context);
        }
    }
}
