using BlogBackend.Application.Common.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BlogBackend.Api.Filters;

public class ApiResponseFilter : IResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ObjectResult { Value: not null } objectResult)
        {
            var value = objectResult.Value;
            var valueType = value.GetType();

            // Skip if already wrapped in ApiResponse<T>
            if (valueType.IsGenericType && valueType.GetGenericTypeDefinition() == typeof(ApiResponse<>))
                return;

            // Wrap in ApiResponse<object>
            var wrapped = new ApiResponse<object>(true, value, null);
            context.Result = new ObjectResult(wrapped)
            {
                StatusCode = objectResult.StatusCode
            };
        }
    }

    public void OnResultExecuted(ResultExecutedContext context) { }
}
