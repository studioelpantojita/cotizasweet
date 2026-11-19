using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;

public sealed record HistoryCursor(string CreatedAt, string Id);
public sealed record QuoteHistoryRow(string Id, JsonObject? Quote, long? TotalCents, string CreatedAt);
public sealed record QuoteHistoryPage(IReadOnlyList<QuoteHistoryRow> Quotes, string? NextCursor);

public static class QuoteHistory
{
    public const int PageSize = 20;
    public const int PayloadLimit = 131_072;
    public const string InvalidCursor = "Cursor del historial inválido.";
    const string Prefix = "v1.";
    const string DateFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

    // Keep this wire format in sync with web/server/history-page.ts and the Python API.
    public static bool TryReadCursor(StringValues values, out HistoryCursor? cursor)
    {
        cursor = null;
        if (values.Count == 0) return true;
        if (values.Count != 1 || values[0] is not { Length: 85 } value ||
            !value.StartsWith(Prefix, StringComparison.Ordinal)) return false;

        var encoded = value[Prefix.Length..];
        if (encoded.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not ('-' or '_'))) return false;
        byte[] bytes;
        try { bytes = WebEncoders.Base64UrlDecode(encoded); }
        catch (FormatException) { return false; }
        if (bytes.Length != 61 || WebEncoders.Base64UrlEncode(bytes) != encoded) return false;
        var decoded = Encoding.UTF8.GetString(bytes);
        if (decoded.Length != 61 || decoded[24] != '|') return false;
        var date = decoded[..24];
        var id = decoded[25..];
        if (!DateTime.TryParseExact(date, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var timestamp) ||
            timestamp.ToString(DateFormat, CultureInfo.InvariantCulture) != date ||
            !Guid.TryParseExact(id, "D", out var guid) || guid.ToString("D") != id) return false;

        cursor = new HistoryCursor(date, id);
        return true;
    }

    public static string EncodeCursor(QuoteHistoryRow row) =>
        Prefix + WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(row.CreatedAt + "|" + row.Id));

    public static JsonObject? ParsePayload(string? payload)
    {
        if (payload is null) return null;
        try { return JsonNode.Parse(payload) as JsonObject; }
        catch (JsonException) { return null; }
    }
}
