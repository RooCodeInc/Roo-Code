# MCP Server Certificate Trust Configuration

This document describes how to configure certificate trust settings for MCP servers that use HTTPS connections (SSE and StreamableHTTP transports).

## Overview

When connecting to MCP servers over HTTPS, you may encounter servers that use:

- Self-signed certificates
- Certificates signed by internal/corporate Certificate Authorities (CAs)
- Certificates that would otherwise be rejected by default Node.js certificate validation

The certificate trust configuration allows you to specify how these certificates should be handled.

## Configuration Options

Certificate trust settings can be added to any SSE or StreamableHTTP server configuration in your MCP settings file.

### Available Options

| Option               | Type    | Default   | Description                                                 |
| -------------------- | ------- | --------- | ----------------------------------------------------------- |
| `allowSelfSigned`    | boolean | false     | Allow connections to servers using self-signed certificates |
| `caCertPath`         | string  | undefined | Path to a CA certificate file (PEM format) to trust         |
| `rejectUnauthorized` | boolean | true      | Whether to reject unauthorized certificates                 |

## Configuration Examples

### 1. Allow Self-Signed Certificates

```json
{
	"mcpServers": {
		"my-internal-server": {
			"type": "sse",
			"url": "https://internal.company.com/mcp",
			"certificateTrust": {
				"allowSelfSigned": true
			}
		}
	}
}
```

### 2. Trust a Custom CA Certificate

```json
{
	"mcpServers": {
		"corporate-server": {
			"type": "streamable-http",
			"url": "https://api.internal.corp/mcp",
			"certificateTrust": {
				"caCertPath": "/path/to/company-ca.pem"
			}
		}
	}
}
```

### 3. Disable Certificate Validation (Development Only)

⚠️ **Warning**: This configuration disables certificate validation entirely and should only be used in development environments.

```json
{
	"mcpServers": {
		"dev-server": {
			"type": "sse",
			"url": "https://dev.local:8443/mcp",
			"certificateTrust": {
				"rejectUnauthorized": false
			}
		}
	}
}
```

### 4. Combined Configuration

```json
{
	"mcpServers": {
		"complex-server": {
			"type": "sse",
			"url": "https://secure.internal.com/mcp",
			"headers": {
				"Authorization": "Bearer token"
			},
			"certificateTrust": {
				"allowSelfSigned": true,
				"caCertPath": "/etc/ssl/certs/internal-ca.pem",
				"rejectUnauthorized": false
			}
		}
	}
}
```

## Obtaining CA Certificates

### From System Certificate Store

On many systems, CA certificates are stored in standard locations:

- **Linux**: `/etc/ssl/certs/` or `/usr/share/ca-certificates/`
- **macOS**: Can be exported from Keychain Access
- **Windows**: Can be exported from Certificate Manager (certmgr.msc)

### From Your IT Department

For corporate environments, contact your IT department to obtain:

1. The internal CA certificate (usually in PEM or CRT format)
2. Instructions on where to save it securely
3. Any specific certificate validation requirements

### Converting Certificate Formats

If you have a certificate in DER/CER format, convert it to PEM:

```bash
openssl x509 -inform der -in certificate.cer -out certificate.pem
```

## Security Considerations

1. **Production Environments**: Always use proper certificates signed by trusted CAs in production.

2. **Certificate Validation**: Only disable `rejectUnauthorized` in development environments where security is not a concern.

3. **CA Certificate Storage**: Store CA certificate files in a secure location with appropriate file permissions.

4. **Regular Updates**: Keep CA certificates up to date, especially for internal CAs that may rotate periodically.

## Troubleshooting

### Common Error Messages

1. **"UNABLE_TO_VERIFY_LEAF_SIGNATURE"**: The server's certificate cannot be verified. Consider adding the CA certificate using `caCertPath`.

2. **"SELF_SIGNED_CERT_IN_CHAIN"**: The certificate chain contains a self-signed certificate. Set `allowSelfSigned: true` if this is expected.

3. **"CERT_HAS_EXPIRED"**: The certificate has expired. Contact the server administrator to renew it.

### Debugging Certificate Issues

To debug certificate issues, you can test the connection using OpenSSL:

```bash
# View server certificate
openssl s_client -connect hostname:port -showcerts

# Test with a specific CA certificate
openssl s_client -connect hostname:port -CAfile /path/to/ca.pem
```

## Limitations

- Certificate trust settings only apply to SSE and StreamableHTTP transports
- STDIO transport servers do not use HTTPS and therefore don't need certificate configuration
- The configuration requires Node.js environment; browser-based implementations may have different requirements

## Related Documentation

- [MCP Server Configuration](./mcp-servers.md)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
