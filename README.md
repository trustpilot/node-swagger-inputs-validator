# swagger-inputs-validator

## About
This project is a fork of https://github.com/michwii/swagger-inputs-validator

The purpose of this middleware is to validate the request parameters provided as
* query parameters
```
https://...?param=yes
```

* path parameters
```
https://.../:pathParam/...
```

* body parameters
```json
{
  "param": {
    "another": "value"
  }
}
```

## Options

When you are calling the constructor, you can specify options :
* **strict** : Default to false. When it's true, SwaggerInputsValidator will reject all the incoming parameters that are not specified in the swagger file
* **onError** : a function that will handle your custom error behaviour
* **allowNull** : Default to true, allows your users to send you (in the body) variables that are equal to null.


## Installation
```Shell
$ npm install @trustpilot/swagger-inputs-validator --save
```

## Usage
```TypeScript
import express from "express";
import { Validator } from "@trustpilot/swagger-request-validator";
import yaml from "yamljs";

const apiDescription = yaml.load("path/to/swagger.yaml");

const app = express();

// As of express 4.16.0, body-parser is built in, and express.json() can be used
// For earlier versions, import and use body-parser explicitly
app.use(express.json());

// Ensure base path is ""
const apiDescriptionNoBasepath = {...apiDescription, basePath: ""}
const errorHandler = (errors, req, res) => {
  res.status(400);//You could choose a custom error code
  res.json({message : "This message is coming from a custom error handler.", errors});
};
const swaggerInputValidator = new Validator.SwaggerInputValidator(
  apiDescriptionNoBasepath,
  {
    allowNull: true,
    onError: errorHandler
  }
);

// You can chose to validate all paths and methods using .all()
app.use(swaggerInputValidator.all());

// or just certain paths and methods
app.get('/products', swaggerInputValidator.get('/products'), (req, res) => {
  res.json({success: 'If you can enter here it seems that swagger validator let you get in'});
});

app.listen(80);

```

## Tests

Unit tests have been written using Mocha.
To launch them, please run the following command :

```Shell
$ npm test
```

## How to contribute ?

This repo uses `commitlint` to enforce commit style rules according to `@commitlint/config-conventional`.

Install them globally

    npm install -g @commitlint/cli @commitlint/config-conventional

Commits must look like:

    <SUBJECT>: message

Choose your SUBJECT according to this logic:

- build: changes to build process only.
- docs: changes to documentation only.
- feat: backwards-compatible enhancement.
- fix: for a bug fix.


## Found a problem ?

Please open an issue or submit a PR, we will be more than happy to help