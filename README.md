# express-aad-jwt

This is an express middleware that validates Azure Active Directory-issued JsonWebToken (JWT) and set the req.user with the decoded JWT.

## Install

```
npm i @kevinhle/express-aad-jwt
```

## Usage

If the JWT is included as bearer scheme in the `Authorization` attribute of the header request, the request will be augmented to include the decoded JWT. The request will include the property `user` which contains the decoded JWT.

In the case JWT is invalid or expires or authorization header is missing in the request, if you want to stop the middleware chain and ultimately the route, set `shouldThrow` to `true` and include some `error handler` for gracefull failure.

```javascript
const expressAadJwt = require('express-aad-jwt')

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
