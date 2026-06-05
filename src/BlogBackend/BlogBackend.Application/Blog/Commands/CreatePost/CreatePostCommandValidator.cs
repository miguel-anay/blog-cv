using FluentValidation;

namespace BlogBackend.Application.Blog.Commands.CreatePost;

public class CreatePostCommandValidator : AbstractValidator<CreatePostCommand>
{
    private static readonly System.Text.RegularExpressions.Regex SlugPattern =
        new(@"^[a-z0-9]+(?:-[a-z0-9]+)*$", System.Text.RegularExpressions.RegexOptions.Compiled);

    public CreatePostCommandValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("Post title is required.");

        RuleFor(x => x.Slug)
            .NotEmpty()
            .WithMessage("Post slug is required.")
            .Matches(SlugPattern)
            .WithMessage("Slug must be URL-safe: lowercase letters, digits, and hyphens only.");
    }
}
