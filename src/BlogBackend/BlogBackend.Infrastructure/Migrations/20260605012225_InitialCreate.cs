using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlogBackend.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "blog");

            migrationBuilder.EnsureSchema(
                name: "subscription");

            migrationBuilder.EnsureSchema(
                name: "identity");

            migrationBuilder.CreateTable(
                name: "authors",
                schema: "blog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_authors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                schema: "blog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "comments",
                schema: "blog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    Body = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "posts",
                schema: "blog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Slug = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    BodyMarkdown = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Tags = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_posts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subscribers",
                schema: "subscription",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Plan = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubscribedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscribers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                schema: "blog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RefreshTokenHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_authors_Email",
                schema: "blog",
                table: "authors",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_categories_Slug",
                schema: "blog",
                table: "categories",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_posts_Slug",
                schema: "blog",
                table: "posts",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscribers_Email",
                schema: "subscription",
                table: "subscribers",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_Name",
                schema: "blog",
                table: "tags",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                schema: "identity",
                table: "users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "authors",
                schema: "blog");

            migrationBuilder.DropTable(
                name: "categories",
                schema: "blog");

            migrationBuilder.DropTable(
                name: "comments",
                schema: "blog");

            migrationBuilder.DropTable(
                name: "posts",
                schema: "blog");

            migrationBuilder.DropTable(
                name: "subscribers",
                schema: "subscription");

            migrationBuilder.DropTable(
                name: "tags",
                schema: "blog");

            migrationBuilder.DropTable(
                name: "users",
                schema: "identity");
        }
    }
}
