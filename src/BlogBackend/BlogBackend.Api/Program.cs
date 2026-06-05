using BlogBackend.Api.Filters;
using BlogBackend.Api.Middleware;
using BlogBackend.Application.Common.Behaviors;
using BlogBackend.Infrastructure;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Reflection;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Infrastructure (EF Core, repositories, token service, email)
builder.Services.AddInfrastructure(builder.Configuration);

// Mediator (source-generated, scoped lifetime)
builder.Services.AddMediator(opts =>
{
    opts.ServiceLifetime = ServiceLifetime.Scoped;
});

// Pipeline behaviors (order matters: logging → validation)
builder.Services.AddTransient(typeof(Mediator.IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
builder.Services.AddTransient(typeof(Mediator.IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

// FluentValidation — register validators from Application assembly
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssembly(
    Assembly.Load("BlogBackend.Application"));

// JWT Authentication
var signingKey = builder.Configuration["JWT__SigningKey"] ?? "dev-signing-key-change-in-production";
var issuer = builder.Configuration["JWT__Issuer"] ?? "blogbackend";
var audience = builder.Configuration["JWT__Audience"] ?? "blogbackend-clients";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// CORS — locked to production + local dev origins (HARD-007)
builder.Services.AddCors(opts => opts.AddDefaultPolicy(policy =>
    policy
        .WithOrigins("https://blog.miguel-anay.nom.pe", "http://localhost:4321")
        .AllowAnyHeader()
        .AllowAnyMethod()));

// Health checks
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=blogbackend;Username=postgres;Password=postgres";
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString);

// Controllers with ApiResponseFilter globally applied
builder.Services.AddControllers(opts =>
{
    opts.Filters.Add<ApiResponseFilter>();
});

// Swagger / OpenAPI with Bearer security definition
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "BlogBackend API",
        Version = "v1",
        Description = "Hexagonal .NET 8 Blog Backend"
    });

    // Bearer JWT security definition (task 4.24)
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token (without 'Bearer ' prefix)."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BlogBackend API v1"));
}

// Middleware pipeline order matters
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Make Program accessible for WebApplicationFactory in integration tests
public partial class Program { }
