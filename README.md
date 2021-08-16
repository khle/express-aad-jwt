# @kevinhle/express-aad-jwt

This is an express middleware that validates AAD-issued (Azure Active Directory) JsonWebToken (JWT) and set the req.user with the decoded JWT.

## Install

```
npm i @kevinhle/express-aad-jwt
```

## Usage

If the JWT is included as bearer scheme in the `Authorization` attribute of the header request, the request will be augmented to include the decoded JWT. The way the request is augmented is that now the request will include the property `user` which contains the decoded JWT.

In the case JWT is invalid or expires or authorization header is missing in the request, if you want to stop the middleware chain and ultimately the route, set `shouldThrow` to `true` and include some `error handler` for gracefull failure.

```javascript
const expressAadJwt = require('@kevinhle/express-aad-jwt')

app.use(
  expressAadJwt({
    tenant: 'your-tenant-name.onmicrosoft.com',
    shouldThrow: true,
  })
)

//error handler
app.use((err, req, res, next) => {
  if (err) {
    res.status(401).json({ Error: err.message })
  }
})
```

If you want the middleware chain to continue (where you might to check the `request.user` object) then pass `false` for `shouldThrow` or just omit it

## apollo-server-express

`@kevinhle/express-aad-jwt` can be paired nicely with `graphql-shield` to provide authentication (and authorization) for `apollo-server-express`. Here's an example of how to do in `typescript`:

```typescript
//server.ts
const { ApolloServer, gql } = require('apollo-server-express')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { ApolloServerPluginLandingPageDisabled } = require('apollo-server-core')
const express = require('express')
const { applyMiddleware } = require('graphql-middleware')
const expressAadJwt = require('@kevinhle/express-aad-jwt')
const permissions = require('./permissions/permissions')

const books = [
  {
    title: 'The Old Man and the Sea',
    author: 'Ernest Hemingway',
  },
  {
    title: 'Twenty Thousand Leagues Under the Seas',
    author: 'Jules Verne',
  },
]

const typeDefs = gql`
  type Book {
    title: String
    author: String
  }

  type Query {
    books: [Book]
  }
`

const resolvers = {
  Query: {
    books: () => books,
  },
}

async function startApolloServer(typeDefs: any, resolvers: any) {
  const server = new ApolloServer({
    schema: applyMiddleware(
      makeExecutableSchema({
        typeDefs,
        resolvers,
      }),
      permissions
    ),
    context: ({ req }: { req: any }) => {
      const user = req.user || null
      return { user }
    },
  })

  // Required logic for integrating with Express
  await server.start()
  const app = express()

  app.use((req: any, res: any, next: Function) => {
    console.log('Express middleware called')
    next()
  })

  app.use(
    '/gql',
    expressAadJwt({ tenant: 'some-tenant.onmicrosoft.com', shouldThrow: false })
  )

  app.use('/something', (req: any, res: any, next: Function) => {
    res.status(200).json({ status: 'ok' })
  })

  //error handler
  app.use((err: Error, req: any, res: any, next: Function) => {
    if (err) {
      res.status(401).json({ Error: err.message })
    }
  })

  server.applyMiddleware({
    app,
    path: '/gql',
  })

  await new Promise((resolve) => app.listen({ port: 4001 }, resolve))
  console.log(`🚀 Server ready at http://localhost:4001${server.graphqlPath}`)
}

startApolloServer(typeDefs, resolvers)
```

where `permissions` is defined in `permissions.ts` as follow:

```typescript
//permissions.ts
const { shield, and, not } = require('graphql-shield')
const { rule } = require('graphql-shield')

const isAuthenticated = rule({ cache: 'contextual' })(
  async (parent: any, args: any, { user }: { user: any }) => {
    if (!user) {
      console.log('Not authenticated!!!')
    } else {
      console.log(user)
    }
    return !!user
  }
)

module.exports = shield({
  Query: {
    books: isAuthenticated,
  },
  /* Mutation: {
    updateBook: isAuthenticated,
  }, */
})
```

In the above example, you would want `shouldThrow` to be `false` so that your Apollo Studio Sandbox is accessible (at `https://studio.apollographql.com/sandbox/explorer?endpoint=http%3A%2F%2Flocalhost%3A4001%2Fgql`).

However, when the client sends a GraphQL request and does not include any AAD-issued or invalid JWT, then the request won't be augmented with the decoded JWT added to `request.user` object. As a result, `graphql-shield` will error out all query and mutation operations without valid AAD-issued JWT.
