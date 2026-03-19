using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Reflection;
using System.Text;

namespace Api.CustomSwagger
{
    /// <summary>
    /// Replaces enum string values in the generated Swagger schema with DescriptionAttribute values when present.
    /// For example, MessageStatus.New will be represented as "جديد" if DescriptionAttribute("جديد") is present.
    /// </summary>
    public class EnumDescriptionSchemaFilter : ISchemaFilter
    {
        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            var type = context.Type;
            var underlying = Nullable.GetUnderlyingType(type) ?? type;
            if (!underlying.IsEnum) return;

            var names = Enum.GetNames(underlying);
            var values = new List<IOpenApiAny>();

            var enumNames = new List<string>();
            var descriptions = new List<string>();
            var seenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var name in names)
            {
                var member = underlying.GetMember(name).FirstOrDefault();
                var description = member?.GetCustomAttribute<DescriptionAttribute>()?.Description ?? name;

                // numeric value
                var enumValue = (int)Convert.ChangeType(Enum.Parse(underlying, name), typeof(int));
                values.Add(new OpenApiInteger(enumValue));

                descriptions.Add(description);

                // Use the DescriptionAttribute value (sanitized) as the left-hand identifier
                // so generators that honor x-enumNames will emit the description-based
                // identifiers. Sanitize to valid identifier characters and ensure uniqueness.
                string Sanitize(string input)
                {
                    if (string.IsNullOrWhiteSpace(input)) return input;
                    var normalized = input.Normalize(System.Text.NormalizationForm.FormKD);
                    var sb = new StringBuilder();
                    foreach (var ch in normalized)
                    {
                        if (char.IsLetterOrDigit(ch)) sb.Append(ch);
                        else sb.Append('_');
                    }
                    var result = sb.ToString();
                    if (string.IsNullOrEmpty(result)) result = "_";
                    if (char.IsDigit(result[0])) result = "_" + result;
                    return result;
                }

                var sanitized = Sanitize(description);
                var unique = sanitized;
                var suffix = 1;
                while (seenNames.Contains(unique))
                {
                    unique = sanitized + "_" + (suffix++).ToString();
                }
                seenNames.Add(unique);
                enumNames.Add(unique);
            }

            // If schema has enum values, replace them
            if (schema.Enum != null && schema.Enum.Count > 0)
            {
                schema.Enum.Clear();
                foreach (var v in values)
                    schema.Enum.Add(v);
            }
            else
            {
                schema.Enum = values;
            }

            // Represent enum as integer values in the schema
            schema.Type = "integer";
            // Use int32 format for numeric enums
            schema.Format = "int32";

            // Provide x-enumNames extension so generators use the sanitized description-based names as the
            // left-hand identifiers when emitting enums for TypeScript/other languages that honor this extension.
            var enumNamesArray = new Microsoft.OpenApi.Any.OpenApiArray();
            foreach (var n in enumNames)
                enumNamesArray.Add(new Microsoft.OpenApi.Any.OpenApiString(n));
            schema.Extensions["x-enumNames"] = enumNamesArray;

            var enumDescriptionsArray = new Microsoft.OpenApi.Any.OpenApiArray();
            foreach (var d in descriptions)
                enumDescriptionsArray.Add(new Microsoft.OpenApi.Any.OpenApiString(d));
            schema.Extensions["x-enumDescriptions"] = enumDescriptionsArray;
        }
    }
}
