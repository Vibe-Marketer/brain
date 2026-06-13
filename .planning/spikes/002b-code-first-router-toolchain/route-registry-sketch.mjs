#!/usr/bin/env node

const routes = [
  { method: 'get', path: '/workspaces', operationId: 'listWorkspaces', handler: 'handleListWorkspaces' },
  { method: 'get', path: '/calls', operationId: 'listCalls', handler: 'handleListCalls' },
  { method: 'get', path: '/calls/{id}', operationId: 'getCall', handler: 'handleGetCall' },
  { method: 'get', path: '/contacts', operationId: 'listContacts', handler: 'handleListContacts' },
  { method: 'get', path: '/speakers', operationId: 'listSpeakers', handler: 'handleListSpeakers' },
]

const paths = Object.fromEntries(
  routes.map((route) => [
    route.path,
    {
      [route.method]: {
        operationId: route.operationId,
        'x-handler': route.handler,
        security: [{ bearerAuth: [] }],
      },
    },
  ]),
)

console.log(JSON.stringify({ routes, paths }, null, 2))

