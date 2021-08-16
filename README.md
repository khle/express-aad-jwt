# express-aad-jwt

This is an express middleware that validates Azure Active Directory-issued JsonWebToken (JWT) and set the req.user with the decoded JWT.

## Install

```
npm i express-aad-jwt
```

## Usage

If you want to stop the chaining if JWT is invalid or expires or authorization header is missing in the request, set `shouldThrow` to `true` and include some `error handler`

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
