# Dental Viewer Backend

This is the refactored backend for the Dental Viewer application, organized using a modular architecture.

## Project Structure

```
backend/
├── config/           # Configuration files
│   ├── constants.js  # Environment constants and configuration
│   ├── database.js   # Database setup and initialization
│   └── upload.js     # File upload configurations
├── controllers/      # HTTP request handlers
│   ├── authController.js    # Authentication operations
│   ├── caseController.js    # Case management operations
│   ├── segmentController.js # Segment management operations
│   └── index.js            # Controller exports
├── middleware/       # Express middleware
│   ├── auth.js      # JWT authentication middleware
│   └── errorHandler.js # Error handling middleware
├── routes/          # API route definitions
│   ├── auth.js      # Authentication routes
│   ├── cases.js     # Case management routes
│   ├── segments.js  # Segment management routes
│   └── debug.js     # Debug routes (development)
├── services/        # Business logic layer
│   ├── authService.js    # Authentication business logic
│   ├── caseService.js    # Case management business logic
│   ├── segmentService.js # Segment management business logic
│   └── index.js          # Service exports
├── utils/           # Utility functions
│   └── fileUtils.js # File operation utilities
├── server.js        # Main application entry point
└── README.md        # This file
```

## Architecture Overview

The backend follows a layered architecture pattern:

- **Routes**: Define API endpoints and HTTP methods
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic and database operations
- **Middleware**: Handle cross-cutting concerns like authentication and error handling
- **Config**: Centralized configuration management
- **Utils**: Reusable utility functions

## Key Features

- **Modular Design**: Each component has a single responsibility
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Authentication**: JWT-based authentication middleware
- **File Uploads**: Support for STL files with size limits and type validation
- **Database**: SQLite database with automatic table initialization
- **Validation**: Input validation at the controller level

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

### Cases
- `GET /api/cases` - Get user cases (protected)
- `POST /api/cases` - Create new case (protected)
- `POST /api/cases/upload` - Upload case with file (protected, legacy)
- `GET /api/cases/:id` - Get specific case (protected)
- `DELETE /api/cases/:id` - Delete case (protected)
- `POST /api/cases/:id/raw` - Upload raw file for case (protected)
- `GET /api/cases/:id/raw` - Get raw file for case (protected)

### Segments
- `POST /api/cases/:id/segments` - Upload segment file (protected)
- `GET /api/cases/:id/segments` - Get segments for case (protected)
- `GET /api/cases/:id/segments/:segmentId` - Get specific segment (protected)
- `PUT /api/cases/:id/segments/:segmentId` - Update segment metadata (protected)
- `DELETE /api/cases/:id/segments/:segmentId` - Delete segment (protected)
- `POST /api/cases/:id/segments/migrate` - Migrate legacy segments (protected)

### Debug (Development)
- `GET /api/debug/segments/:caseId` - Debug segments for case (protected)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens

## Database

The application uses SQLite with automatic table creation. Tables include:
- `users`: User accounts and authentication
- `cases`: Dental cases and file metadata
- `segments`: Dental segments with metadata

## File Storage

Files are stored in the `uploads/` directory with the following structure:
```
uploads/
├── {caseId}/
│   ├── raw/
│   │   └── model.stl
│   └── segments/
│       ├── segment-{timestamp}-{random}.stl
│       └── ...
```

## Error Handling

All errors are handled consistently with appropriate HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (invalid token)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error (server errors)

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- File type validation
- File size limits
- User authorization checks
