using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
public class QuoteStore
{
    readonly string path;
    SqliteConnection Open() { var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=path,DefaultTimeout=5}.ToString());db.Open();return db; }
    public QuoteStore(string database) {
        path=Path.GetFullPath(database);Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var db=Open();using var cmd=db.CreateCommand();
        cmd.CommandText="PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS quotes_owner_history ON quotes(owner,created_at DESC,id DESC);";cmd.ExecuteNonQuery();
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);
    }
    public QuoteHistoryPage List(string owner, HistoryCursor? cursor = null) {
        using var db=Open();
        using var cmd=db.CreateCommand();
        var condition=cursor is null ? "" : "AND (created_at,id)<($created,$id)";
        cmd.CommandText=$"""
            SELECT id,
              CASE WHEN typeof(total_cents)='integer' AND total_cents BETWEEN 0 AND 9007199254740991 THEN total_cents END,
              created_at,
              CASE WHEN length(CAST(payload AS BLOB)) <= $payloadLimit THEN payload END
            FROM quotes WHERE owner=$owner {condition}
            ORDER BY created_at DESC,id DESC LIMIT $limit
            """;
        cmd.Parameters.AddWithValue("$owner",owner);
        cmd.Parameters.AddWithValue("$payloadLimit",QuoteHistory.PayloadLimit);
        cmd.Parameters.AddWithValue("$limit",QuoteHistory.PageSize+1);
        if(cursor is not null){
            cmd.Parameters.AddWithValue("$created",cursor.CreatedAt);
            cmd.Parameters.AddWithValue("$id",cursor.Id);
        }
        using var rows=cmd.ExecuteReader();
        var quotes=new List<QuoteHistoryRow>();
        while(quotes.Count<QuoteHistory.PageSize && rows.Read()){
            var payload=rows.IsDBNull(3)?null:rows.GetString(3);
            quotes.Add(new QuoteHistoryRow(rows.GetString(0),QuoteHistory.ParsePayload(payload),
                rows.IsDBNull(1)?null:rows.GetInt64(1),rows.GetString(2)));
        }
        var nextCursor=rows.Read()?QuoteHistory.EncodeCursor(quotes[^1]):null;
        return new QuoteHistoryPage(quotes,nextCursor);
    }
    public object Save(string owner,JsonObject q) {
        var id=Guid.NewGuid().ToString();var totalCents=QuoteDomain.Totals(q)["total"];var createdAt=DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="INSERT INTO quotes VALUES ($id,$owner,$payload,$total,$created)";
        cmd.Parameters.AddWithValue("$id",id);cmd.Parameters.AddWithValue("$owner",owner);cmd.Parameters.AddWithValue("$payload",q.ToJsonString());cmd.Parameters.AddWithValue("$total",totalCents);cmd.Parameters.AddWithValue("$created",createdAt);cmd.ExecuteNonQuery();
        return new{id,quote=q,totalCents,createdAt};
    }
}
