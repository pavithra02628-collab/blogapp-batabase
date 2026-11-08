# Inkwell Blog

A full-stack blogging web app.

Live site: https://blogapp-batabase.onrender.com

## Features
- Sign up, sign in and log out (JWT in an HTTP-only cookie, bcrypt password hashing)
- Create, edit, delete, like, comment on and bookmark blog posts
- Explore page with search, category filter and pagination
- Individual blog detail page
- Light and dark mode, colour themes

## Tech stack
Node.js, Express.js, MongoDB Atlas (Mongoose), REST API, HTML, CSS, JavaScript

## REST API
- POST /api/auth/signup, /api/auth/signin, /api/auth/logout
- GET /api/auth/me
- GET /api/blogs and GET /api/blogs/:id
- Authorised create, read, update and delete endpoints under /api/data

## Run locally
1. npm install
2. Set MONGODB_URI and JWT_SECRET environment variables
3. npm start
