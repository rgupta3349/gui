import { Request, Response, NextFunction } from 'express'
import { execFile } from 'child_process'
import { cliStderrResponse, unautorizedResponse } from './handlers/util'
import * as crypto from '@shardus/crypto-utils';
const yaml = require('js-yaml')
const jwt = require('jsonwebtoken')

function isValidSecret(secret: unknown) {
  return typeof secret === 'string' && secret.length >= 32;
}

function generateRandomSecret() {
  return Buffer.from(crypto.randomBytes(32)).toString('hex');
}

const jwtSecret = (isValidSecret(process.env.JWT_SECRET))
  ? process.env.JWT_SECRET
  : generateRandomSecret();
crypto.init('64f152869ca2d473e4ba64ab53f49ccdb2edae22da192c126850970e788af347');

export const loginHandler = (req: Request, res: Response) => {
  const password = req.body && req.body.password
  const hashedPass = crypto.hash(password);
  // Exec the CLI validator login command
  execFile('operator-cli', ['gui', 'login', hashedPass], (err, stdout, stderr) => {
    if (err) {
      cliStderrResponse(res, 'Unable to check login', err.message)
      return
    }
    if (stderr) {
      cliStderrResponse(res, 'Unable to check login', stderr)
      return
    }

    const cliResponse = yaml.load(stdout)

    if (cliResponse.login !== 'authorized') {
      unautorizedResponse(req, res)
      return
    }
    const accessToken = jwt.sign({ nodeId: '' /** add unique node id  */ }, jwtSecret)
    res.send({accessToken: accessToken })
  })
  console.log('executing operator-cli gui login...')
}

export const jwtMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-api-token']

  if (!token) {
    unautorizedResponse(req, res)
    return
  }

  jwt.verify(token, jwtSecret, (err: any, jwtData: any) => {
    if (err) {// invalid token
      unautorizedResponse(req, res)
      return
    }

    next()
  })
}
