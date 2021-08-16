const jsonwebtoken = require('jsonwebtoken')
//const axios = require('axios')
const https = require('https')
const http = require('http')

let X5cCerts = []

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('Url is required'))

    const { body, method = 'GET', ...restOptions } = options
    const client = url.startsWith('https') ? https : http

    const request = client.request(url, { method, ...restOptions }, (res) => {
      let chunks = ''

      res.setEncoding('utf8')

      res.on('data', (chunk) => {
        chunks += chunk
      })

      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: chunks })
      })
    })

    request.on('error', (err) => {
      reject(err)
    })

    if (body) {
      request.setHeader('Content-Length', body.length)
      request.write(body)
    }

    request.end()
  })
}

function getTenantId(jwtString) {
  const decodedToken = jsonwebtoken.decode(jwtString)
  if (decodedToken) {
    return decodedToken.tid
  } else {
    return null
  }
}

function verify(jwt, certificate) {
  const options = {
    algorithms: ['RS256'],
    issuer: `https://sts.windows.net/${getTenantId(jwt)}/`,
  }

  let isValid = true
  // verify the token
  try {
    jsonwebtoken.verify(jwt, certificate, options)
  } catch (error) {
    isValid = false
  }

  return {
    decoded: jsonwebtoken.decode(jwt),
    valid: isValid,
  }
}

async function getJwksUri(tenantOpenIdconfig) {
  try {
    //const response = await axios.get(tenantOpenIdconfig)
    //const jwksUri = response.data.jwks_uri
    const response = await fetch(tenantOpenIdconfig, { method: 'GET' })
    const jwksUri = JSON.parse(response.body).jwks_uri
    return jwksUri
  } catch (e) {
    throw e
  }
}

async function getX5cCerts(jwksUri) {
  try {
    //const response = await axios.get(jwksUri)
    //const x5c = response.data.keys.map((key) => key.x5c)
    const response = await fetch(jwksUri, { method: 'GET' })
    const x5c = JSON.parse(response.body).keys.map((key) => key.x5c)
    const flattened = [].concat.apply([], x5c)
    return flattened
  } catch (e) {
    throw e
  }
}

function makeCompatCert(cert) {
  return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`
}

function verifyAadJwt(jwt) {
  let result
  try {
    const isValidJwt = !X5cCerts.every((cert) => {
      const compatCert = makeCompatCert(cert)
      result = verify(jwt, compatCert)
      if (result.valid) {
        return false
      }
      return true
    })
    return result
  } catch (e) {
    console.log(e)
  }
}

function handle401(shouldThrow, errorMessage, next) {
  if (shouldThrow) {
    next(Error(errorMessage))
  } else {
    next()
  }
}

module.exports = function (options) {
  if (!options || !options.tenant) throw new Error('tenant must be set')
  const { tenant, shouldThrow } = options

  const middleware = async function (req, res, next) {
    if (X5cCerts.length == 0) {
      const tenantOpenIdconfig = `https://login.windows.net/${tenant}/.well-known/openid-configuration`

      const jwksUri = await getJwksUri(tenantOpenIdconfig)
      X5cCerts = await getX5cCerts(jwksUri)
    }
    if (req.headers && req.headers.authorization) {
      var parts = req.headers.authorization.split(' ')
      if (parts.length === 2) {
        var scheme = parts[0]
        var jwt = parts[1]

        if (/^Bearer$/i.test(scheme)) {
          const result = verifyAadJwt(jwt)
          if (result.valid) {
            req.user = result.decoded
            next()
          } else {
            handle401(shouldThrow, 'Invalid authorization header', next)
          }
        } else {
          handle401(shouldThrow, 'Invalid scheme in authorization header', next)
        }
      } else {
        handle401(shouldThrow, 'Invalid authorization header', next)
      }
    } else {
      handle401(shouldThrow, 'No authorization header', next)
    }
  }
  return middleware
}
