import axios from "axios";


// Fot testing
// export const domain = "localhost:3002";

// const port = 5000;

// // Created a new instance of axios with the dynamically selected baseURL
// export default axios.create({
//     baseURL: `http://localhost:${port}/api/v1/`,
// });

// For Prod
export const domain = "srg.social";

// Created a new instance of axios with the dynamically selected baseURL
export default axios.create({
    baseURL: `https://cluster.srg.social/api/v1`,
});
