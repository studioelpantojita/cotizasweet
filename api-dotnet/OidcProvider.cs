using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

public static class OidcProvider
{
    public static bool Validate(IConfiguration configuration, IHostEnvironment environment)
    {
        var provider = configuration["OIDC_PROVIDER"] ?? "standard";
        if (provider is not ("standard" or "google"))
            throw new InvalidOperationException("OIDC_PROVIDER debe ser standard o google.");
        if (provider != "google") return false;
        var issuer = new Uri(configuration["OIDC_ISSUER"]!);
        var local = environment.IsDevelopment() && configuration["OIDC_ALLOW_LOCAL_HTTP"] == "true" &&
            issuer.Scheme == "http" && issuer.Host is "127.0.0.1" or "localhost";
        if (!local && configuration["OIDC_ISSUER"] != "https://accounts.google.com")
            throw new InvalidOperationException("El perfil Google requiere su emisor oficial.");
        if (!local && !Regex.IsMatch(configuration["OIDC_AUDIENCE"] ?? "",
            @"\A[A-Za-z0-9_-]+\.apps\.googleusercontent\.com\z", RegexOptions.CultureInvariant))
            throw new InvalidOperationException("Configura la audiencia del cliente OAuth web de Google.");
        return true;
    }

    public static bool VerifiedGoogleIdentity(ClaimsPrincipal? user, string audience)
    {
        var azp = user?.FindFirstValue("azp");
        var multipleAudiences = user?.FindAll("aud").Skip(1).Any() == true;
        return string.Equals(user?.FindFirstValue("email_verified"), "true", StringComparison.OrdinalIgnoreCase) &&
            (azp == audience || (azp is null && !multipleAudiences));
    }
}
