# S3 Proxy Lambda Function

This Lambda function acts as a secure proxy to Amazon S3, providing CRUD operations for files and folders in the demo S3 bucket through REST API endpoints.

## Features

- **Create**: Upload files and create folders
- **Read**: List objects/folders and download files
- **Update**: Replace existing files
- **Delete**: Delete files or folders (with recursive deletion for folders)
- **Security**: Integrated with Cognito authentication
- **Binary Support**: Handles all file types including images, documents, etc.
- **Folder Operations**: Full folder management with recursive deletion
- **CORS Enabled**: Ready for web application integration

## API Endpoints

All endpoints require valid authentication headers (`Authorization: Bearer <token>`).

### List Objects
```
GET /s3
GET /s3?prefix=folder/path/
GET /s3?prefix=folder/&delimiter=/
```
Lists objects and folders in the S3 bucket. Use `prefix` to filter by path and `delimiter` to control folder structure display.

### Create Folder
```
POST /s3
Content-Type: application/json

{
  "folderName": "new-folder"
}
```
Creates a new folder at the root level.

### Upload File
```
POST /s3/{file-path}
Content-Type: application/json

{
  "content": "file content or base64 encoded binary data",
  "contentType": "text/plain"
}
```
Uploads a file to the specified path. Binary files should be base64 encoded.

### Download File
```
GET /s3/{file-path}
```
Downloads a file. Returns the file content with appropriate Content-Type headers.

### Update File
```
PUT /s3/{file-path}
Content-Type: application/json

{
  "content": "updated file content",
  "contentType": "text/plain"
}
```
Updates/replaces an existing file.

### Delete File
```
DELETE /s3/{file-path}
```
Deletes a single file.

### Delete Folder (Recursive)
```
DELETE /s3/{folder-path}/?folder=true
```
Deletes a folder and all its contents recursively. Use the `folder=true` query parameter to indicate folder deletion.

## Response Formats

### Success Responses
- **200 OK**: Operation successful
- **201 Created**: File/folder created successfully

### Error Responses
- **400 Bad Request**: Invalid request parameters
- **403 Forbidden**: Access denied
- **404 Not Found**: File/folder not found
- **500 Internal Server Error**: Server error

### Example Success Response
```json
{
  "message": "Object 'documents/file.txt' uploaded successfully",
  "key": "documents/file.txt",
  "size": 1024,
  "contentType": "text/plain"
}
```

### Example List Response
```json
{
  "objects": [
    {
      "key": "documents/file.txt",
      "size": 1024,
      "lastModified": "2025-01-01T12:00:00.000Z",
      "type": "file"
    }
  ],
  "folders": [
    {
      "key": "images/",
      "type": "folder"
    }
  ],
  "total": 2,
  "truncated": false
}
```

## Environment Variables

- `S3_BUCKET_NAME`: The target S3 bucket name (configured automatically by CDK)
- `LOG_LEVEL`: Logging level (INFO, DEBUG, etc.)

## IAM Permissions

The Lambda function has the following S3 permissions on the demo bucket:
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`
- `s3:GetObjectVersion`
- `s3:DeleteObjectVersion`

## Key Features

### Folder Operations
- Create empty folders by adding a trailing slash
- Recursive deletion removes all files and subfolders
- Batch deletion for efficient folder cleanup (up to 1000 objects per batch)

### Binary File Support
- Automatic MIME type detection
- Base64 encoding for binary responses
- Support for all file types (images, documents, archives, etc.)

### Error Handling
- Comprehensive error logging
- Proper HTTP status codes
- Detailed error messages for debugging

### Security
- Integration with existing Cognito authentication
- CORS headers configured for web applications
- Bucket access restricted to configured demo bucket only

## Usage Examples

### JavaScript/TypeScript
```javascript
// Upload a text file
const uploadResponse = await fetch('/api/s3/documents/readme.txt', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Hello, World!',
    contentType: 'text/plain'
  })
});

// List files in a folder
const listResponse = await fetch('/api/s3?prefix=documents/', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Delete a folder recursively
const deleteResponse = await fetch('/api/s3/old-folder/?folder=true', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Monitoring

The Lambda function includes:
- **Structured Logging**: Using AWS Lambda Powertools
- **Distributed Tracing**: X-Ray integration
- **Custom Metrics**: CloudWatch metrics for operations
- **Error Tracking**: Detailed error logging and monitoring

## Deployment

The S3 proxy Lambda is automatically deployed as part of the CDK stack with:
- Proper IAM roles and policies
- API Gateway integration
- CloudWatch logging
- X-Ray tracing enabled
