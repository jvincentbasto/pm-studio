# Initial plan

This is just an initial plan

Help me start and improve the plan, identifying the (what, how, when, and why), and the things that I'm not aware-of in terms of overall structure or architechtural desgin:

- accessibility, security, performance, scaling, etc.

## AI agent releated

Only use any other skill, agent, plugin, mcps/tools or any ai related tool when the user explicitly names it in the current chat.

- Skills
  - preferred
    - Matt Pocock
    - Impeccable
    - Tasteskill
  - optional
    - Ponytail
    - Superpowers

- MCP/Tools
  - preferred
    - github
    - chrome dev tools
    - context7
    - composio
  - optional
    - playwright
    - stripe
    - any related tools to the project

## Cloud Options

- prefer platforms that doesnt need constant/often project/resource re-enabling,
  - recommended: no pausing of project/resource
  - preferred: re-enable project/resource
    - once every 3 or 1 month, or every 2 weeks
  - samples:
    - appwrite pauses cloud storage after 1 week
    - preferred: mongodb.com only pauses project/resource after 3 months

## Implementation Approach

### Categories

Implementation are ordered by categories:

- **BACKEND**
  - server setup
    - structure/architecture design
      - patterns
      - conventions
      - type safety
      - scopes
      - limitaitons
      - etc
    - security
      - restrictions
      - limitations
      - etc
    - performance/caching
    - scalling
      - envs
      - builds
      - etc
    - backup
      - easy migration plans
      - standalones
        - sample: if email fails - auth, otp, reset links, subscriptions, and others should have alternative ways/process that could keep the app operating and avoid breaking
      - etc
    - optional documentation
      - jsdoc, swagger, etc
    - etc

  - api

```md
# api

## core functions

- basic crud operations
- bulk crud operations
- nested data (max 2 tables, but adjustable)
- optional:
  - stored custom sql queries 
    - for custom, special, or advance cases
    - a table for storing and executing sql operations such as: 
      - joins 
      - subqueries
      - a simple select query
      - etc
    - scopes: 
      - only do operations for data records of a table/s, 
      - no modifying schemas for table, db, etc
- etc

```

```md
## advance structure

### defaults

- entry points
  - main 
    - /main 
    - /
  - current (for development/experimental) 
    - /current

- values
  - options
    - root: 
      - /main or "/", /current
    - env: 
      - dev, staging, prod
      - :8000, :8100, :9000
      - dev.{domain}, staging.{domain}, prod.{domain} or {domain}
    - server: 
      - expressjs, fastify, graphql, apollo etc
    - db / odm / orm: 
      - sql, sqlite, postgresql, sequelize, prisma, drizzle
      - mongodb, mongoose
      - etc

  - default
    - root: /main or "/"
    - env: dev
    - server: expressjs
    - db: mongoose

_
### setup patterns

- localhost
  - {localhost}/{entry}/{env}/{servers}/{db}/{versions}
- localhost ports
  - use port as env
    - 8000 (dev), 8100 (staging), 9000 (prod)
  - {localhost:port}/{entry}/{servers}/{db}/{versions}
- live
  - use subdomains as env
  - {env}.{domain}/{entry}/{servers}/{db}/{versions}

- samples
  - equivalents to {domain}/v1
    - {localhost}/dev/expressjs/mongoose/v1
    - {localhost:8000}/expressjs/mongoose/v1
    - dev.{domain}/expressjs/mongoose/v1

```

```md
## query strings

### requirements

- query strings should be readable as much as possible so that the links can be sharable 
- avoid invalids/conflicts
- should have a backup that is safety first 
  
#### guidelines
  
  - percent-encoding
      - skip/optional encoding
        - Reserved & Special Characters
          - ?, &, =, (,), etc
      - possible invalids/conflicts
        - Common Punctuation & Symbols
          - quotes, parenthesis, brackets, etc
        - Invisible & Control Characters
          - Backspace, Tab, New Line, etc

  - common
    - wrap the values with double quotes ("") if it contains underscore, spaces, special characters, etc
      - ?filter[:field]=:values 
      - unencoded: ?filter[color]="_yellow-green",red,green
    
    - encoding
      - values wrapped in quotes mainly can be uncoded
        - ?filter[color]=%22_yellow-green%22,red,green     
      - delimeters
        - default (readable/sharable): comma (,)
        - backup (safety): 
          - percent-encoded commas (,) (%2C)
            - then api decodes and split values 

    - field names remain in brackets
      - patterns
        - ?[:mainKey][:key][:field]=:value1,value2
        - ?:mainKey_:key[:field]=:value1_value2
      - samples
        - ?filter[or][color]=red
        - ?filter_or[color]=red
        - ?filter[gr2][or]=gr1,status
        - ?filter_gr2_or=gr1_status

  - versions
    - sharable
      - key value pair placement are important
        - ?q[i][smart]=%22Thunder%20Bolt%22,thunder,bolt
        - ?filter[gr2][or]=gr1,status
      - delimeters: 
        - default: comma (,)
        - optional: underscore (_), for more readability
      
    - backup
      - key placement can be random, but should still follow the default placements. 
        - ?filter_gr2_or=gr1_status 
        - ?filter_or_gr2=gr1_status 
      - field and values should follow
      - delimeters: underscore (_)

#### samples (unencoded)

sharable:
  - ?q[i][smart]="Thunder Bolt",thunder,bolt
  - ?filter[or][category]="_partial software",hardware,software&filter[and][color]=red,green&filter[status]=active
  - &filter[gr_1][and]=category,color&filter[gr_2][or]=gr1,status
backup:
  - ?q_i_smart="Thunder Bolt"_thunder_bolt
  - ?filter[or][category]="_partial software"_hardware_software&filter_and_[color]=red,green&filter[status]=active
  - &filter[gr_1][and]=category,color&filter[gr_2][or]=gr1,status

```

```md
### operations

all params should be able to do single or multiple operations

- search
  - casing
    - sensitive (default)
    - insensitve
  - match types
    - exact
    - partial
    - smart (exact then partial)

```

```md
- filter
  - "single value" (strings) fields
    - inner: only "or"
    - outer: "or/and", default: and
  - "multiple value" (array) fields
    - inner: "or/and"
    - outer: "or/and", default: and

  - values
    - placeholders
      - "single value" fields
        - inner operator: :inner
        - outer operator: :outer
        - field: :field
        - value: :value
        - number: :n
    - keys
      - main: filter
      - group: 
        - filter[group], filter[gr], filter[g]
        - filter_group, filter_gr, filter_g

    - options
      - strings fields
        - inner: only "or"
        - outer: "or/and"
      - array fields
        - inner: "or/and"
        - outer: "or/and"  
    
    - defaults
      - ?filter[or] == ?filter
      - operators
        - inner operator: "or"
        - outer operator: "and"
      - sample: 
        - ?filter[or][:field1]=value1[:outer]filter[or][:field2]=value1
          - ?filter[or][:field1]=value1&filter[or][:field2]=value1
          - or (:inner): field1, field2
          - and (:outer): & 
  
  - patterns
    - string field
      - default: ?filter[or] == ?filter
      - ?filter[:inner][:field]=value

    - array fields
      - single "outer operator"
        - &filter[:gr][:inner]=field
      
      - multiple "outer operator"
        - filter
          - ?filter[:inner][:field1]
        - filter group
          - v1
            - &filter[:gr1][:inner]=field1,field2&filter[:gr2][:inner]=field3&filter[:gr3][:inner]=gr1,gr2
            - &filter[:gr1][:inner]=field1,field2&filter[:gr2][:inner]=field3,gr1
          - v2 
            - &filter_gr1_:inner=field1_field2&filter_gr2_:inner=field3&filter_gr3_:inner=gr1_gr2
            - &filter_gr1_:inner=field1_field2&filter_gr2_:inner=field3_gr1


    sample data (string fields)
      - id: 1, category: hardware, status: active, color: red
      - id: 2, category: software, status: idle, color: green
      
    sample data (array fields)
      - id: 1, category: [hardware], status: active, color: [red]
      - id: 2, category: [software], status: idle, color: [green]
      - id: 3, category: [hardware,software], status: active, color: [red, green]
      - id: 4, category: [hardware,software], status: idle, color: [red, green]
```

```md
- sort 
  - modes: asc, desc
  - sort per field

- fieldsets
  - default: all fields
  - select 
  - include 
    - default: select none, add specified
    - keys: include, inc, in
  - exclude 
    - default: select all, remove specified
    - keys: exclude, exc, ex

- pagination
  - default of 100 records
  - max limit of 100 records
  - modes: offset, cursor

```

```md
### operation flow patterns

each phase is optional

- table -> search -> filter -> sort -> fieldsets -> pagination
- table -> search -> filter -> sort
- table -> filter -> sort


### samples (unencoded)

- search
  - casing
    - sensitive: 
      - ?q=quantum,physics
      - ?q=quantum_physics
    - insensitive: 
      - ?q[i]="Quantum Pyhsics",science
      - ?q_i="Quantum Pyhsics"_science
  - match types
    - exact
      - ?q="Quantum Pyhsics"
      - ?q[exact]="Thunder Bolt",lightning
      - ?q[i][exact]="Thunder Bolt",lightning
      - ?q_i_exact="Thunder Bolt"_lightning
      - ?q_exact_i="Thunder Bolt"_lightning
    - partial / any        
      - ?q[partial]="Thunder Bolt",lightning
      - ?q[i][partial]="Thunder Bolt",lightning
      - ?q_i_partial="Thunder Bolt"_lightning
      - ?q_partial_i="Thunder Bolt"_lightning
    - smart
      - ?q[i][smart]="Thunder Bolt",thunder,bolt
      - ?q_i_smart="Thunder Bolt",thunder,bolt

```

```md
- filter
  - single field
    - ?filter[and][category]=hardware,software
    - ?filter_and[category]=hardware_software
    - ?filter[color]=red,green
    - ?filter[color]=red_green

  - multiple fields
    - single "outer operator"
      - ?filter[or][category]=hardware,software&filter[and][color]=red,green&filter[status]=active
      - ?filter_or[category]=hardware_software&filter_and[color]=red_green&filter[status]=active

    - multiple "outer operator"
      - filter
        - ?filter[or][category]=hardware,software&filter[and][color]=red,green&filter[status]=active
        - ?filter_or[category]=hardware_software&filter_and[color]=red_green&filter[status]=active
      - filter group
        - &filter[gr1][and]=category,color,status
        - &filter_gr1_and=category_color_status
        - &filter[gr1][and]=category,color&filter[gr2][or]=gr1,status
        - &filter_gr1_or=category_color&filter_gr2_and=status_gr1

```

```md
- sort
  - ?sort=-published_year,title
  - ?sort=published_year_-title

- fieldsets:
  - ?fields=id,title,author,price
  - ?fields[inc]=title,author,price
  - ?fields[exc]=id,author,price
  - ?fields_inc=title_author_price
  - ?fields_exc=id_author_price

- pagination:
  - offset: ?page=3&limit=25
  - cursor: ?starting_after=xyz&limit=50

```

```md
## performance and safety measures

  - status codes, error handling
  - caching, indexing
  - debounce, throttle
  - rate-limiting, retries, lockout
  - global or per resource blacklist/whitelist
  - logging
  - ignore query params that exposes sensitive data which include fields like: 
    - password, ids, etc
  - set max character limit on url strings
  - etc

```

- _
  - db (security, performance/caching, easy migration plans between sql to nosql and vice-versa)

  - authentication
    - email/password
    - social logins
      - google, github
      - optional: microsoft, apple
    - multiplatform logins
      - devices: desktop, mobile, etc
      - browsers: chrome, firefox, brave, etc
    - optional: sso
    - passwordless: email/sms only login (optional email validation)
    - guest accounts
      - regular guest account
        - passwordless: email/sms login, possible password, limit resources, delete the account after 3 days
      - browser-sandbox account
        - no login, data/states are browser/localstorage scoped only

  - authorization/permissions
    - default: RBAC, ABAC, PBAC
    - optional: ReBAC, ACL

  - emails, sms, storage, push notifications
    - email
      - providers: mailtrap, resend, brevo, etc
      - subscriptions, push notifications
    - sms: twilio, etc
    - storage
      - media: cloudinary, etc
      - large files: cloudflare, etc
  - export tools for: pdf, excel, jsons, docs, etc
    - pdf: pdf-lib, pdfkit, pdf-parse, jspdf, pdf-node ?
    - excel: exceljs, excel4node, xlsx-template
    - docs: docx, @turbodocx/html-to-docx, officegen

  - optional background operations (crons, hooks/webhooks, logging, scheduling, etc)
  - network protocols / api paradigms
    - core
      - rest, graphql, websockets
    - backend/event
      - webhooks
      - MQTT
        - Walkie-talkie protocol built for low-power smart home and IoT gadgets
      - AMQP (RabbitMQ)
        - Smart post office that routes heavy background tasks to worker servers
      - Kafka (logger/tracker)  
        - Continuous security tape that records massive streams of data forever
      - webRTC, gPRC, tRPC, SSE

  - search: algolia
  - benchmarks
  - deployment (docker, k8s, serverless/vps, iac, etc)
  - cloud, automations, etc

- **FRONTEND**
  - overall setup - structure (patterns, conventions, etc), security (restrictions, limitations, etc), performance/caching, scalling (envs, builds, etc), etc
  - routes, states (redux toolkit, tanstack - query, etc)

  - server side rendering
    - infinite scrolling
    - polling
    - required: server side search, filter, sort, pagination, etc
  - client side rendering
    - required: client side search, filter, sort, pagination, etc
      - purely frontend states after fetching server side results

  - charts
    - Chart.js, ApexCharts
    - Recharts, shadcn/ui Charts
    - D3, visx
    - nivo, Tremor
    - AG Charts, Highcharts
  - richtext editor:
    - @tiptap/react, @lexical/react, slate-react, react-quill-new, @tinymce/tinymce-react, jodit-react ?
  - export tools for: pdf, excel, jsons, docs, etc
    - pdf: @react-pdf/renderer, react-pdf ?
    - excel: xlsx

  - bare/minimal layouts/components
  - optional animations
  - polished ui/ux

- **TESTING**
  
  use whatever's possible
  
  - core testing: unit, integration, system, uat, etc
  - functional: funnctional, regression, smoke, etc
  - non-functional: security/penetration, load/stress, usability/accessibility (a11y), performance, etc
  - e2e, benchmarks, automation

- **MASTER-VERSIONS**
  - create versions of the main app (master/main branch), for testing/experimenting new/other implementations

```md
# samples

  - master/main: default js, nosql version

  - versions
    - master-ts : ts version
    - master-sql : sql version
    - master-sql-ts : ts, sql version

```

### Options

#### 1st Option

straight forward

- backend
- frontend
- testing
- optional MASTER-VERSIONS

#### 2nd Option (default)

straight forward with minimal templating for testing

- backend
  - include minimal frontend ui and backend testing
- frontend
  - include minimal frontend testing
- testing
  - final testing
- optional MASTER-VERSIONS

## Initial Plan (What)

I'm starting a project management project, I'm still not sure what are the features. I'm open to suggestions that is easy to integrate, use, maintain, maximizing security, scaling, performance, etc

### Features

#### V1 (core)

- app should include the core features of a project management website.
- auth:
  - default: email/password
  - social logins: google, github
  - guest accounts
    - regular guest account: passwordless with email/sms login (optional email validation), optional password, 10 records per resource limitation, delete the account after 3 days
    - browser-sandbox: no login, data/states browser localstorage
- email
  - otps, reset links, email verifications, etc
- optional sms
  - otps, reset links, email verifications, etc
- local/cloud storage
- project management (kanban), dashboards with charts, tracking, logging, etc
- richtext editor for forms
- can export files like: pdf, excel, jsons, docs, etc

#### V2

#### Optional version - MASTER-VERSIONS

- master-ts :a ts version for both backend and frontend
- master-sql :an sql db version (maybe use, neon? supabase?)
- master-sql-ts :a ts, sql db version

### Techinical

#### Project structure

root / [backend, frontend] \
backend / [lib, models, controllers, middlewares, routes] \
frontend / src / [app, components, utils]

#### Tech stack

- **Backend**
  - node js, express js, mongodb (mongoose)
  - auth
    - default: email/password
    - passwordless: email (optional email validation)
    - social logins: auth0
      - google, github
      - optional passwordless: sms only login
  - email: smtp - mailtrap, brevo, resend
  - testing: jest, vitest, mocha ?
  - etc

- **Frontend**
  - next js
  - ui: tailwind, shadcn, etc
  - states: redux-toolkit(main), tanstack - query, etc
  - charts: charts js
  - richtext editor
    - @tiptap/react, @tinymce/tinymce-react ?
  - testing: jest, vitest, mocha ?
  - etc

- **Testing**
  - e2e: playwright, cypress, puppeteer ?

- **Domain**
  - godaddy

- **Deployment**
  - render

- **Cloud options**
  - storage
    - small/media: cloudinary
    - large file: cloudflare
    - others: supabase, uplaodcare ?

#### Build

build backend (package.json) \
build frontend (package.json) \
root consolidates backend and frontend builds (package.json) \

## Why

## How
