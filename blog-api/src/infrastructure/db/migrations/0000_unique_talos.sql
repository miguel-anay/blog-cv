CREATE TABLE `article_categories` (
	`article_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`article_id`, `category_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`cover_url` text,
	`cover_alt` text,
	`author_id` integer,
	`read_min` integer DEFAULT 1 NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`avatar_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_email_unique` ON `authors` (`email`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `cv_cursos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`categoria` text NOT NULL,
	`nombre` text NOT NULL,
	`institucion` text,
	`fecha` text,
	`certificado` text,
	`externo` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cv_educacion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`institucion` text NOT NULL,
	`titulo` text NOT NULL,
	`estado` text,
	`anio_inicio` integer,
	`anio_fin` integer
);
--> statement-breakpoint
CREATE TABLE `cv_experiencia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`periodo` text,
	`cargo` text NOT NULL,
	`empresa` text NOT NULL,
	`certificado` text,
	`logo` text,
	`tecnologias` text,
	`proyectos` text
);
--> statement-breakpoint
CREATE TABLE `cv_personal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`sitio` text,
	`descripcion` text,
	`empresas_destacadas` text,
	`tecnologias_destacadas` text,
	`linkedin` text,
	`anio` integer
);
--> statement-breakpoint
CREATE TABLE `cv_proyectos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`titulo` text NOT NULL,
	`empresa` text,
	`descripcion` text,
	`url` text,
	`imagen` text,
	`tecnologias` text
);
--> statement-breakpoint
CREATE TABLE `site_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_title` text NOT NULL,
	`site_description` text NOT NULL,
	`about_markdown` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`rol` text DEFAULT '' NOT NULL,
	`linkedin` text DEFAULT '' NOT NULL,
	`github` text DEFAULT '' NOT NULL,
	`twitter` text DEFAULT '' NOT NULL,
	`og_image` text
);
