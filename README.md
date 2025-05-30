# Cezary Czerwiński - CMS System

A Firebase-based Content Management System (CMS) for managing the content of cezary-czerwinski.pl website. This system provides secure admin access to manage blog posts, contact messages, and newsletter subscriptions.

## 🌟 Features

### Content Management
- Blog post creation and editing
- Rich text editor support
- Image upload and management
- Category and tag management
- Draft and publish workflow

### Contact Management
- View and manage contact form submissions
- Export contact data
- Spam protection
- IP tracking for security

### Newsletter System
- Subscriber management
- Email validation
- Duplicate prevention
- Subscription tracking
- Export capabilities

### Security Features
- Firebase Authentication
- Role-based access control
- CORS protection
- Request validation
- IP tracking
- Rate limiting

### Integration Features
- Automatic revalidation of Next.js pages
- Real-time updates
- Webhook support
- Error logging and monitoring

## 🚀 Tech Stack

- **Platform**: Firebase
- **Functions**: Firebase Cloud Functions
- **Database**: Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

## 🔧 Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

3. Login to Firebase:
   ```bash
   firebase login
   ```

4. Initialize Firebase:
   ```bash
   firebase init
   ```

5. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```

## 🔐 Environment Variables

Required environment variables:
- `NEXT_PRIVATE_REVALIDATION_TOKEN`
- Firebase project configuration

## 📝 Security Rules

The project includes security rules for:
- Firestore database
- Storage buckets
- Function access control

## 🔄 API Endpoints

### Contact Form
- `POST /sendContactMessage`
  - Handles contact form submissions
  - Validates input
  - Stores in Firestore

### Newsletter
- `POST /subscribeToNewsletter`
  - Manages newsletter subscriptions
  - Validates email
  - Prevents duplicates

### Content Revalidation
- Automatic revalidation on content updates
- Triggers on post creation/update/deletion
- Updates homepage and blog pages

## 📝 License

All rights reserved. This project is proprietary and confidential. 