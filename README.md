# Dental Viewer with Authentication

A comprehensive dental case management system with 3D visualization capabilities, featuring user authentication and case management.

## Features

- 🔐 **User Authentication**: Secure login/register system with JWT tokens
- 📁 **Case Management**: Upload, view, and manage dental cases
- 🦷 **3D Visualization**: Interactive 3D viewer for STL files
- 📊 **Treatment Planning**: Advanced treatment planning tools
- ✂️ **Dental-Aware Segmentation**: Semi-automated tooth isolation using
  enamel–dentin contrast, surface orientation and anatomical heuristics
- 🔍 **Search & Filter**: Find cases quickly with search functionality
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
├── backend/           # Node.js backend
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── env.example        # Environment variables template
├── src/                   # Vue.js frontend
│   ├── components/        # Vue components
│   │   ├── LoginPage.vue  # Login/Register page
│   │   ├── CasesPage.vue  # Cases management page
│   │   └── DentalViewer.vue # 3D viewer component
│   ├── router.ts          # Vue router configuration
│   └── main.ts           # Main Vue app entry
└── README.md             # This file
```

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend-auth

# Install dependencies
npm install

# Create environment file
cp env.example .env

# Edit .env file with your configuration
# PORT=3001
# JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
# NODE_ENV=development

# Start the server
npm run dev
```

The backend will be available at `http://localhost:3001`

### 2. Frontend Setup

```bash
# Install frontend dependencies (if not already installed)
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 3. Default Login

The system creates a default admin user:
- **Username**: `admin`
- **Password**: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Cases
- `GET /api/cases` - Get user's cases
- `POST /api/cases/upload` - Upload new case
- `GET /api/cases/:id` - Get specific case
- `DELETE /api/cases/:id` - Delete case

## Frontend Routes

- `/login` - Login/Register page
- `/cases` - Cases management page
- `/viewer/:caseId` - 3D viewer for specific case

## Features in Detail

### Authentication System
- JWT-based authentication
- Secure password hashing with bcrypt
- Automatic token refresh
- Protected routes with navigation guards

### Case Management
- Upload STL files (up to 50MB)
- Case naming and organization
- Search and filter functionality
- Case status tracking
- Delete cases with confirmation

### 3D Viewer Integration
- Seamless integration with existing 3D viewer
- Case-specific data loading
- Treatment planning tools
- Export capabilities

## Development

### Backend Development
```bash
cd backend-auth
npm run dev  # Start with nodemon for auto-reload
```

### Frontend Development
```bash
npm run dev  # Start Vite dev server
npm run build  # Build for production
npm run preview  # Preview production build
```

## Environment Variables

### Backend (.env)
```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

## Database

The system uses SQLite for simplicity:
- Automatic database creation
- User and cases tables
- Foreign key relationships
- Automatic cleanup of deleted files

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- CORS configuration
- File upload validation
- SQL injection prevention
- XSS protection

## File Upload

- Supports STL files only
- Maximum file size: 50MB
- Automatic file validation
- Secure file storage
- Automatic cleanup on deletion

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend is running on port 3001
2. **Database Errors**: Check if database.sqlite file is writable
3. **File Upload Issues**: Verify file is STL format and under 50MB
4. **Authentication Errors**: Clear localStorage and re-login

### Logs

Backend logs are displayed in the console. Check for:
- Database connection errors
- File upload issues
- Authentication problems

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use a strong JWT_SECRET
3. Configure proper CORS origins
4. Use a production database (PostgreSQL/MySQL)

### Frontend
1. Build with `npm run build`
2. Serve static files from a web server
3. Configure proper API endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
