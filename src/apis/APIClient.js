import axios from "axios";

export const domain = "localhost:3002";

// const ports = {
//     1: 3000,
//     2: 5000,
// }

// const selectedServer = localStorage.getItem("server");
// const port = ports[selectedServer];

// if(!selectedServer){
//     localStorage.setItem("server", 1);
//     window.location.reload(false);
// }
// else if(!(selectedServer in ports)){
//     alert("Invalid Server Selected. Redirecting to Default Server");
//     localStorage.setItem("server", 1);
//     window.location.reload(false);
// }

const port = 5000;

// Created a new instance of axios with the dynamically selected baseURL
export default axios.create({
    baseURL: `http://localhost:${port}/api/v1/`,
});
