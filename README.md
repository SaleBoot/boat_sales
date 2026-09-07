# BoatSaler

Interactive boat showcase built with Vite, React, Three.js, and GSAP.

## Live Demo

GitHub Pages: https://mcwhirr.github.io/BoatSaler/

## Local Development

### Go server:
- enter backend folder:
```sh
   cd backend
```

- build:  
```sh 
    go build
```

- prepare env file 

  in 'backend' folder, copy `.env.example` to `.env`:
```sh 
    cp .env.example  .env 
```
  modify `.env` as needed,like: 
  ![.env.example](/backend/.env.example.png)


- run 
 in 'backend' folder,  run the server:
```sh 
    ./boatsales-backend
```


### Frontend app:

- Install: `cd frontend && npm install`
- Start dev server: `npm run dev`
- Build: `npm run build`
- Preview production build: `npm run preview`

 
 `frontend/public/gltf01/` is the runtime directory for the boat models in development environment.  
 



## Cloud Deployment

The Go server can now host the built frontend as well as the runtime `gltf/` and `pdf/` assets.

1. Build the frontend: `cd frontend && npm run build`
2. Start the Go server: `cd gltf && go run .`
3. Open `http://localhost:8080/`
4. Open `http://localhost:8080/#/admin` for model and video management

External media links for the public page are managed in `data/site-content.json` through the admin UI and currently support normalized YouTube and Bilibili URLs.

## Project Structure

- `frontend/`: Vite app, UI, and Three.js scene
- `backend/`: Go server, database, and COS storage 

