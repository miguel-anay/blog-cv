# TaskFlow - Project Specifications

## Project Description

Realizar la integracion entre Astro y Strapi Y mejorar el color y diseño de la pagina.

## User Stories

### Epic 1: Conexion Strapi con blog

#### US-001: Pagina de Inicio y strapi content managment Inicio

como usuario, yo quiero conectar mi api strapi con index.astro, la cual es la primera pagina segun techinal notes, tambien en el header funcione correctamente el modo oscuro.

**Acceptance Criteria:**

- Hacer que funcione el modo oscuro y modo light de <ThemeToggle>
- QUE el blogcar se enlace con la api de strapi "articles"de "api/inicio"
- enlazar SITE_TITLE ,SITE_DESCRIPTION, con la api strapi "api/inicio" pero dentro del main <div class="blog-header"> de tal manera se cree parrafos que respeten la api por ejemplo en la api esta "site_description hay campos llamados paragraft y list" quiero que crees los componentes necesarios para que segun la api entregue este se cree.
  **Technical Notes:** (http://localhost:1337/api/inicio?populate=\*)(http://localhost:3000/)(strapi_mcp)

#### US-002: Modo Claro y oscuro con reactjs

como usuario,quiero que implementes "island_load" en el "ThemeToggle" implementando reactjs, y enlazar categories, y crear cards mas pequeños de color diferente que se vea con un color diferente y que tonice con la aplicacion

**Acceptance Criteria:**

- Hacer que funcione el modo oscuro y modo light de <ThemeToggle>
- implementar HOOkS.
- Crear cards mas pequeños que se van bien con la aplicacion y que tenga un color acorde con la aplicacion, que se diferencie con el resto, aplicar en el color triangulacion del color o otro metodo de tal manera que el color sea agradable para el usuario.
  -Enlazar la api de strapi "api/Inicio" con la cards nuevas crreadas para categorias.

  **Technical Notes:** (http://localhost:1337/api/inicio?populate=\*)(http://localhost:3000/)(strapi_mcp)

#### US-003: Arreglar Header modo celular, y cambiar modo oscuro y claro al componente (src/components/DynamicContent.astro)

como usuario,quiero que cuando pasa a modo celular el <header> que se vea las opciones Home,blog, about, en modo celular, por otro lado, quiero que el componente [fucnione el modo oscuro y claro](src/components/DynamicContent.astro)

**Acceptance Criteria:**

- que se vea el modo celular el header, y aparesca las 3 rayas por defecto, en la parte derecha y al costod de las 3 rauas se vea el boton light, dark
- que el componente DynamicContent.astro funcione correctamente.

#### US-004: Arreglar Header modo celular, y cambiar modo oscuro y claro al componente (src/components/DynamicContent.astro)

como usuario,quiero que cuando pasa a modo celular el <header> que se vea las opciones Home,blog, about, en modo celular, por otro lado, quiero que el componente [fucnione el modo oscuro y claro](src/components/DynamicContent.astro)

**Acceptance Criteria:**

- que se vea el modo celular el header, y aparesca las 3 rayas por defecto, en la parte derecha y al costod de las 3 rauas se vea el boton light, dark
- que el componente DynamicContent.astro funcione correctamente.

#### US-005: Conectar api strapi seccion blog con el astro page blog

como usuario,quiero que la api de strapi que el "blocs" que tiene como tipo de type (paragraph,list,code,image) se conecte con la pagina de blog astro [blog astro](src/pages/blog/[...slug].astro) como un articulo
**Acceptance Criteria:**

- En el caso de "paragraph" considerar como un parafro
- en el caso de "code" ponerlo en el "code-block"
- en el caso de "list" crear la listas
- debe ser parecido al "[toamlo como ejemplo](src/components/DynamicContent.astro)"

  **Technical Notes:** http://localhost:1337/api/articles/{id} [blog astro](src/pages/blog/[...slug].astro)

#### US-006: Centrar los BlogCard a sola una columna, y verificar que cargue los articles

como usuario, quiero que en esta ruta (/src/content.config.ts) la const blog carge correctamente y alimente a la pagina /blog, tambien quiero que todos mis articulos en (callous-cluster\src\pages\blog\index.astro) el comoponente <BlogCard> cargue en una sola columna.

**Acceptance Criteria:**

- que la pagina de blog se cargue correctamente con los articles
- que los <BlogCarc> esten centrados y espaciados **Technical Notes:**

#### US-007: correcto funcionanmiento de categories.lengh y carga de pagina blog filtrado por categoria

como usuario, quiero <CategoryCard> de (callous-cluster\src\pages\index.astro) cargue correctamente "articlecount" tambien cuando se haga click que la pagina ([se cargue y filtre correctamente los blogs por categorias](src/pages/blog/category/[slug].astro))

**Acceptance Criteria:**

- que el contador en <CategoryCard> de la pagina "blog" funcione correctamente, esto se debe CONTAR en base al categories-articles por articulo, por ejemplo si si la categoria es "aws" y si articulo 1 tiene aws, y articulo 2 tiene aws, azure, entonce el contado de categoria de aws es 2
- cuando se haga click en <CategoryCard> se abra la pagina "category-blog" filtrado correctamente por cateogoria, tomar como referencia la pagina "blog", por ejemplo si haces click en la categoria aws , este abre la pagina "/blog/category/aws" Y muestra todos los articulos que tengas al menos tenga dentro de categories una categoria "aws"
  -tener en cuenta que (http://localhost:1337/api/articles?populate=\*) tiene un campo llamado "categories": [] que es un array, y este tiene 1 a mas categorias

**Technical Notes:**
category-blog:([se cargue y filtre correctamente los blogs por categorias](src/pages/blog/category/[slug].astro))
blog:(src/pages/blog/[...slug].astro)
categories-articles: (http://localhost:1337/api/articles?populate=\*) la cual tiene un "categories": [] que es un array,

## Data Structure

## Business Rules

#### US-008: implementar <CategoryCard> en la page categories , reemplazarlo y centrar la pagina

como usuario, quiero el diseño de la categories sea el mismo de <CategoryCard> de (callous-cluster\src\pages\index.astro) y la pagina se centre
**Acceptance Criteria:**

- <CategoryCard> debe estar implementado en "categories" , los colores deben de ser el mismo que en la pagina de inicio
- centrar la pagina y tener 3 columnas en pantalla grande y chica 1 columna

**Technical Notes:**
categories:[class categories-grid](src/pages/blog/categories.astro)
