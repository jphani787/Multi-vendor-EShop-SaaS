import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "Auth service API",
    description: "Automatically generated Swagger docs",
    version: "1.0.0",
  },
  host: "localhost:6001",
  schemes: ["http"],
};

const outputfile = "./swagger-output.json";
const endpointsFiles = ["./routes/auth.router.ts"];

swaggerAutogen()(outputfile, endpointsFiles, doc);
