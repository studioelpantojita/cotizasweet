using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

/// History pagination, identical to web/server/history-page.ts and api-python/main.py:
/// limit 1–50 (20 by default) and a `before` cursor "createdAt_id" of the last row seen.
public sealed record HistoryPage(int Limit,string? BeforeCreatedAt=null,string? BeforeId=null)
{
    public const int Default=20, Max=50;
    static readonly Regex Cursor=new(@"^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$",RegexOptions.CultureInvariant);
    static readonly Regex Digits=new("^[0-9]{1,3}$",RegexOptions.CultureInvariant);
    /// Returns null for any malformed, repeated or out-of-range parameter.
    public static HistoryPage? Parse(IQueryCollection query)
    {
        var limits=query["limit"];var cursors=query["before"];
        if(limits.Count>1 || cursors.Count>1)return null;
        var limit=Default;
        if(limits.Count==1) {
            if(!Digits.IsMatch(limits[0]??""))return null;
            limit=int.Parse(limits[0]!);
            if(limit is < 1 or > Max)return null;
        }
        if(cursors.Count==0)return new(limit);
        var match=Cursor.Match(cursors[0]??"");
        return match.Success?new(limit,match.Groups[1].Value,match.Groups[2].Value):null;
    }
}

public class QuoteStore
{
    readonly string path;
    public string DatabasePath => path;
    SqliteConnection Open() { var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=path,DefaultTimeout=5}.ToString());db.Open();return db; }
    public QuoteStore(string database) {
        path=Path.GetFullPath(database);Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var db=Open();using var cmd=db.CreateCommand();
        cmd.CommandText="PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS quotes_owner ON quotes(owner,created_at DESC);";cmd.ExecuteNonQuery();
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);
    }
    public object List(string owner,HistoryPage? page=null) {
        page??=new(HistoryPage.Default);
        using var db=Open();using var cmd=db.CreateCommand();
        // One extra row tells whether another page exists without a second query.
        cmd.CommandText="SELECT id,payload,total_cents,created_at FROM quotes WHERE owner=$owner"+(page.BeforeCreatedAt!=null?" AND (created_at<$at OR (created_at=$at AND id<$id))":"")+" ORDER BY created_at DESC,id DESC LIMIT $take";
        cmd.Parameters.AddWithValue("$owner",owner);cmd.Parameters.AddWithValue("$take",page.Limit+1);
        if(page.BeforeCreatedAt!=null){cmd.Parameters.AddWithValue("$at",page.BeforeCreatedAt);cmd.Parameters.AddWithValue("$id",page.BeforeId!);}
        using var rows=cmd.ExecuteReader();var result=new List<(string id,JsonNode? quote,long total,string created)>();
        while(rows.Read())result.Add((rows.GetString(0),JsonNode.Parse(rows.GetString(1)),rows.GetInt64(2),rows.GetString(3)));
        var more=result.Count>page.Limit;if(more)result.RemoveAt(result.Count-1);
        return new{quotes=result.Select(r=>new{id=r.id,quote=r.quote,totalCents=r.total,createdAt=r.created}).ToList(),nextCursor=more?$"{result[^1].created}_{result[^1].id}":null};
    }
    public object Save(string owner,JsonObject q) {
        var id=Guid.NewGuid().ToString();var totalCents=QuoteDomain.Totals(q)["total"];var createdAt=DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="INSERT INTO quotes VALUES ($id,$owner,$payload,$total,$created)";
        cmd.Parameters.AddWithValue("$id",id);cmd.Parameters.AddWithValue("$owner",owner);cmd.Parameters.AddWithValue("$payload",q.ToJsonString());cmd.Parameters.AddWithValue("$total",totalCents);cmd.Parameters.AddWithValue("$created",createdAt);cmd.ExecuteNonQuery();
        return new{id,quote=q,totalCents,createdAt};
    }
}
