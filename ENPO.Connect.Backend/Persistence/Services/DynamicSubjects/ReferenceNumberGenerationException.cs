using System;

namespace Persistence.Services.DynamicSubjects;

public sealed class ReferenceNumberGenerationException : Exception
{
    public ReferenceNumberGenerationException(string message)
        : base(message)
    {
    }
}
