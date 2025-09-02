using System.Collections.Generic;

namespace ExpressionBuilderService.AI
{
    public class AIFormRequest
    {
        public string Message { get; set; } = string.Empty;
        // optional current schema to give context
        public string? CurrentSchemaJson { get; set; }
        // domain hint: "form"
        public string? Category { get; set; }
    // If true, instruct LLM to return only a JSON schema object (no prose)
    public bool FormOnly { get; set; } = false;
    }

    public class SuggestedField
    {
        public string Name { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Type { get; set; } = "text"; // text|number|select|boolean
        public bool Required { get; set; }
        public string? ValidationRegex { get; set; }
        public int? MaxLength { get; set; }
        public string? Description { get; set; }
    }

    public class AIFormResponse
    {
        public string Explanation { get; set; } = string.Empty;
        public List<SuggestedField> SuggestedFields { get; set; } = new List<SuggestedField>();
        public string SchemaJson { get; set; } = string.Empty; // suggested JSON schema
        public string Confidence { get; set; } = "medium";
        public bool IsValid { get; set; } = true;
        public string Transcript { get; set; } = string.Empty; // assistant text
    }
}
