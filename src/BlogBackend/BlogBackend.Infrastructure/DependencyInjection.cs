using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Identity.Ports;
using BlogBackend.Domain.Subscription.Ports;
using BlogBackend.Infrastructure.Auth;
using BlogBackend.Infrastructure.Email;
using BlogBackend.Infrastructure.Messaging;
using BlogBackend.Infrastructure.Persistence;
using BlogBackend.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BlogBackend.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // EF Core — PostgreSQL
        services.AddDbContext<BlogDbContext>(opts =>
            opts.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Blog repositories
        services.AddScoped<IPostRepository, PostRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ITagRepository, TagRepository>();
        services.AddScoped<IAuthorRepository, AuthorRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();

        // Subscription repositories
        services.AddScoped<ISubscriberRepository, SubscriberRepository>();

        // Identity repositories + token service
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ITokenService, TokenService>();

        // Email
        services.AddScoped<IEmailNotificationPort, SmtpEmailNotificationAdapter>();

        // Background task queue + email worker
        services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
        services.AddHostedService<EmailWorkerService>();

        return services;
    }
}
