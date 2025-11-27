/**
 * Auth-Agent MCP SDK for TypeScript
 * OAuth 2.1 middleware for MCP servers
 */

export { authAgentMiddleware } from './middleware.js';
export { AuthAgentClient } from './client.js';
export type {
  AuthAgentConfig,
  IntrospectionResponse,
  AuthUser,
} from './types.js';
export {
  AuthenticationError,
  AuthorizationError,
} from './types.js';
