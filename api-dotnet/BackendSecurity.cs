using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System.Text.RegularExpressions;

public static class BackendSecurity
{
    public static bool IsUtf8JsonContentType(string? contentType)
    {
        if (!string.Equals(contentType?.Split(';', 2)[0].Trim(), "application/json", StringComparison.OrdinalIgnoreCase)) return false;
        var charset = Regex.Match(contentType!, @";\s*charset\s*=\s*""?([^;""\s]+)", RegexOptions.IgnoreCase);
        return !charset.Success || string.Equals(charset.Groups[1].Value, "utf-8", StringComparison.OrdinalIgnoreCase);
    }

    public static void ValidateStartup(IConfiguration configuration, IHostEnvironment environment)
    {
        var issuer = configuration["OIDC_ISSUER"] ?? "";
        if (!Uri.TryCreate(issuer, UriKind.Absolute, out var url) ||
            !string.IsNullOrEmpty(url.UserInfo) || !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
            throw new InvalidOperationException("Configura un emisor OIDC válido sin credenciales, consulta ni fragmento.");
        var allowLocal = configuration["OIDC_ALLOW_LOCAL_HTTP"] == "true";
        if (allowLocal && !environment.IsDevelopment())
            throw new InvalidOperationException("OIDC_ALLOW_LOCAL_HTTP no está permitido en producción.");
        var local = environment.IsDevelopment() && allowLocal && new[] { "localhost", "127.0.0.1" }.Contains(url.Host);
        if (url.Scheme != "https" && !local)
            throw new InvalidOperationException("OIDC requiere HTTPS.");
        if (string.IsNullOrWhiteSpace(configuration["OIDC_AUDIENCE"]))
            throw new InvalidOperationException("Configura OIDC_AUDIENCE.");
        var secret = configuration["INTEGRATION_SERVICE_KEY"] ?? "";
        if (secret.Length is < 32 or > 256 || secret.Any(c => c < 33 || c > 126))
            throw new InvalidOperationException("INTEGRATION_SERVICE_KEY requiere entre 32 y 256 caracteres ASCII sin espacios.");
    }
}
