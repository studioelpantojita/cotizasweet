using System.Text.Json;
using System.Text.Json.Nodes;

var cases=JsonNode.Parse(File.ReadAllText(args[0]))!.AsObject();
var totals=cases["valid"]!.AsArray().Select(q=>QuoteDomain.Totals(QuoteDomain.Validate(q,creating:true))).ToArray();
bool Accepted(JsonNode? q) {
    try {QuoteDomain.Validate(q,creating:true);return true;}
    catch(ArgumentException) {return false;}
    catch(FormatException) {return false;}
}
var invalidAccepted=cases["invalid"]!.AsArray().Select(Accepted).ToArray();
Console.Write(JsonSerializer.Serialize(new {totals,invalidAccepted}));
