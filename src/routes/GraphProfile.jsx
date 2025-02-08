import React, { useEffect, useContext, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import APIClient from "../apis/APIClient";
import DOMPurify from "dompurify";
import { UserContext } from "../context/UserContext";
import { useErrors } from "../context/ErrorContext";
import Navbar from "../components/Navbar";
import Headbar from "../components/Headbar";
import "../styles/profile.css";
import UsernameEmoji from "../components/UsernameEmoji";

import { ForceGraph2D } from "react-force-graph";
import * as d3 from "d3";

// import CytoscapeComponent from "react-cytoscapejs";
// import Cytoscape, { Core } from "cytoscape"; 
// import cise from "cytoscape-cise";
// import fcose from "cytoscape-fcose";

// Cytoscape.use(cise);
// Cytoscape.use(fcose);

function GraphProfile() {
    const {id} = useParams();
    const {currentUser, isLoggedIn} = useContext(UserContext);
    const {setError, setToast} = useErrors();
    const [user, setUser] = useState({
            avatar: "",
            username: "",
            acct: "",
            note: "",
        });
    const [statuses, setStatuses] = useState([]);
    const [following, setFollowing] = useState(false);
    const [followedBy, setFollowedBy] = useState(false);
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const sanitizedHtml = DOMPurify.sanitize(user.note);
    let navigate = useNavigate();
    const [display_name, setDisplayName] = useState("");
    const graphRef = useRef();
    const [elements, setElements] = useState([{ id: "You", label: "You" }]);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    // const [layout, setLayout] = useState({
    //     name: "cise",
    //     clusters: [], // This will be populated dynamically
    //     boundingBox: { x1: 0, y1: 0, w: 400, h: 400 }, // Reduce bounding box size
    //     nodeSeparation: 20, // Adjust separation between nodes in clusters
    //     idealInterClusterEdgeLengthCoefficient: 0.1, // Decrease to bring clusters closer
    //     clusterSeparation: 40, // Reduce cluster separation
    //     allowNodesInsideCircle: false, // Ensure proper node placement
    // });
    const theme = localStorage.getItem("selectedTheme");

    useEffect(() => {
        if(!isLoggedIn){
            navigate("/");
        }
        fetchUserProfile(); 
    }, [id]);

    useEffect(() => {
        checkRelation();
    }, []);

    useEffect(() => {
        document.title = `${user.display_name || user.username} (@${user.username === user.acct ? `${user.username}@${currentUser.instance}` : user.acct}) | Vikalp`;
    });

      useEffect(() => {
        
        const cleanAndProcessData = async () => {
            try {
                // Clean statuses
                // statuses.forEach((status) => {
                //     const temp = status.content
                //         .replace(/(<([^>]+)>)/gi, "") // Remove HTML tags
                //         .replace("&#39;", "'"); // Decode HTML entity
                //     if (temp) {
                //         cleanIdAndContent[status.id] = temp;
                //     }
                // });
    
                // const request = await axios.get(`http://localhost:5000/api/v1/accounts/${id}`, {
                //     params: {
                //         instance: currentUser.instance,
                //     }
                // })

                const newelements = [];
                const clusterList = [];
                const links = [];

                // Add cleaned posts as nodes
                // Object.keys(cleanIdAndContent).forEach((id) => {
                //     newelements.push({
                //         data: { id: id, label: trimString(cleanIdAndContent[id], 100) },
                //     });
                // });

                // Add category nodes and edges
                Object.keys(statuses.cluster).forEach((category) => {
                    const cluster = [];
                    newelements.push({ 
                        id: category, type: "category", color: "blue", label: category }
                    );

                    console.log(newelements);

                    statuses.cluster[category].elements.forEach((post) => {
                        // Ensure the post node exists
                        //console.log(post.id);
                        if (!newelements.some((el) => el.id === post.id)) {
                            let content = trimString(post.content.replace(/(<([^>]+)>)/gi, "").replace("&#39;", "'"), 100);
                            newelements.push({ 
                                id: post.id, type: "post", label: content, color: "orange", content: content
                            });
                        };

                        cluster.push(post.id);

                        console.log(newelements);
                        // Add edge only if both source and target exist
                        if(newelements.some((el) => el.id == category) &&
                            newelements.some((el) => el.id === post.id)) {
                            links.push(
                                { source: category, target: post.id },
                            );
                        }
                    });

                    clusterList.push(cluster);
                });

                console.log(newelements);
                console.log(links);
                setGraphData({ nodes: newelements, links });

                setElements([...newelements]);
                // const ciseLayout = {
                //     name: "cise",
                //     clusters: clusterList, // This will be populated dynamically
                //     boundingBox: { x1: 0, y1: 0, w: 400, h: 400 }, // Reduce bounding box size
                //     nodeSeparation: 40, // Adjust separation between nodes in clusters
                //     idealInterClusterEdgeLengthCoefficient: 0.2, // Decrease to bring clusters closer
                //     clusterSeparation: 30, // Reduce cluster separation
                //     allowNodesInsideCircle: false, // Ensure proper node placement
                // }

                // setLayout(fcoseLayout);
            } catch (error) {
                console.error("Error processing data:", error.message);
            } finally {
                setLoading(false);
            }
        };
    
        if (statuses) {
            setLoading(true);
            cleanAndProcessData();
        }
    }, [statuses]);

    const fcoseLayout = {
        name: "fcose",
        gravity: 0.25, // Pull clusters closer
        nodeRepulsion: () => 5000,
        idealEdgeLength: () => 200,
        avoidOverlap: true,
        randomize: true, // Prevent re-randomization of nodes
        animationDuration: 1000,
        nodeSeparation: 40,
        idealInterClusterEdgeLengthCoefficient: 0.2,
        clusterSeparation: 40,
    };
    
    const cytoscapeStylesheet = [
        {
            selector: "node",
            style: {
                "background-color": theme == "dark" ? "#1976d2" : "#9ee1f7",
                width: "label",
                height: "label",
                // a single "padding" is not supported in the types :(
                "padding-top": "8",
                "padding-bottom": "8",
                "padding-left": "8",
                "padding-right": "8",
                // this fixes the text being shifted down on nodes (sadly no fix for edges, but it's not as obvious there without borders)
                "text-margin-y": -3,
                "text-background-padding": "20",
                shape: "round-rectangle",
                // label: 'My multiline\nlabel',
            },
        },
        {
            selector: ".category",
            style: {
            "background-color": theme == "dark" ? "purple" : "#90fc90",
            shape: "ellipse",
            width: function (ele) {
                return ele.degree() * 25;
            },
            height: function (ele) {
                return ele.degree() * 25;
            },
            "font-size": function (ele) {
                return ele.degree() * 25;
            },
            },
        },
        {
            selector: "node[label]",
            style: {
            label: "data(label)",
            "font-size": "24",
            color: theme == "dark" ? "#ffffff" : "#000000",
            "text-halign": "center",
            "text-valign": "center",
            "text-wrap": "wrap",
            "text-max-width": "300",
            },
        },
        {
            selector: "edge",
            style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            opacity: 0.4,
            width: 1.5,
            },
        },
        {
            selector: "edge[label]",
            style: {
            label: "data(label)",
            "font-size": "12",
            "text-background-color": "white",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
            "text-margin-y": -4,
            // so the transition is selected when its label/name is selected
            "text-events": "yes",
            },
        },
        {
            selector: "node.highlight",
            style: {
            "border-color": "#FFF",
            "border-width": "2px",
            },
        },
        {
            selector: "node.semitransp",
            style: { opacity: 0.5 },
        },
        {
            selector: "edge.highlight",
            style: { "mid-target-arrow-color": "#FFF" },
        },
        {
            selector: "edge.semitransp",
            style: { opacity: 0.2 },
        },
    ];

    // function to fetch the profile details of the user
    async function fetchUserProfile(){
        try {
            setLoading(true);
            const response = await APIClient.get(`/accounts/${id}`, {params: {instance: currentUser.instance}});
            // console.log(response.data)
            setUser(response.data.account);
            setStatuses(response.data.statuses);
            setDisplayName(response.data.account.display_name);
            setLoading(false);
        } catch (error) {
            console.log(error);
            setError(error.response.data);;
        }
    }

    // function to check the relation of the user with the current user
    async function checkRelation(){
        try {
            const response = await axios.get(`https://${currentUser.instance}/api/v1/accounts/relationships`, {
                params: {"id" : id},
                headers: {
                    Authorization: `Bearer ${currentUser.token}`,
                },
            });
            setFollowing(response.data[0].following);
            setFollowedBy(response.data[0].followed_by)
        } catch (error) {
            console.log(error);
        }
    }

    // function to follow the user
    async function handleFollow(){
        try {
            const response = await APIClient.post(`/accounts/${id}/follow`, {
                instance: currentUser.instance,
                token: currentUser.token,
            });
            setFollowing(true);
        } catch (error) {
            setError(error.response.data);;;
        }
    }

    // function to unfollow the user
    async function handleUnfollow(){
        try {
            const response = await APIClient.post(`/accounts/${id}/unfollow`, {
                instance: currentUser.instance,
                token: currentUser.token,
            });
            setFollowing(false);
        } catch (error) {
            setError(error.response.data);
        }
    }

    function formatData(data){
        let message = data;
        if(data > 1000){
            message = `${(data/1000).toFixed(2)}k`;
            data = data/1000;
            if(data > 100) message = `${Math.round(data)}k`;
        }
        return message; 
    }

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    function trimString(str, maxLength) {
        if (str.length > maxLength) {
            return str.slice(0, maxLength) + "...";
        } else {
            return str;
        }
    }
    
    const handlePanToOrigin = () => {
        if (graphRef.current) {
            graphRef.current.fit();
            graphRef.current.center();
        }
    };
    
    return (
        <div className="main">
            <Navbar />
            <div className=" container">
                <Headbar />
                {loading && <div className="loader"></div>}
                <div className="profile">
                    <div className="header-container">
                        {user.header !== "https://mastodon.social/headers/original/missing.png" && <img className="profileHeader" src={user.header} />}
                        {followedBy && <div className="followed-by">Follows you</div>}
                    </div>
                    <div className="profileTop">
                        <div className="profileTopLeft">
                            <img className="profileImg" src={user.avatar} alt="profile" />
                        </div>
                        <div className="profileTopRight">
                            {/* show edit profile button only if the user is the current user */}
                            {currentUser.id === id ? 
                                <button type="button" className="btn btn-outline-secondary" onClick={handleShow}>Edit Profile</button>
                            :
                                <>
                                    {following ? 
                                        <button type="button" className="btn btn-outline-secondary" onClick={handleUnfollow}>Unfollow</button> 
                                    : 
                                        <button type="button" className="btn btn-outline-secondary" onClick={handleFollow}>Follow</button>
                                    }
                                </>
                            }
                        </div>
                    </div>
                    <div className="user">
                        <span className="profileUsername">{display_name === '' ? display_name : <UsernameEmoji key={user.id} name={user.display_name || user.username} emojis={user.emojis}/>}</span>
                        <span className="profileUserInstance">{user.username === user.acct ? `${user.username}@${currentUser.instance}` : user.acct}</span>
                    </div>
                    <div className="profileStats"><strong><span>{formatData(user.followers_count)}</span> Followers <span>{formatData(user.following_count)}</span> Following</strong></div>
                    <div className="profileCenter">
                        <span className="profileText"><div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} /></span>
                    </div>
                </div>
                <h2 style={{textAlign: "center"}}>POSTS</h2>

                {/* <CytoscapeComponent
                    cy={(cy) => {
                        cy.fit();
                        cy.center();
                        cy.zoom(1);

                        // Node Hover Effects
                        cy.on("mouseover", "node", function (e) {
                            let sel = e.target;
                            cy.elements()
                                .difference(sel.outgoers())
                                .not(sel)
                                .addClass("semitransp");
                            sel.addClass("highlight").outgoers().addClass("highlight");
                        });

                        cy.on("mouseout", "node", function (e) {
                            let sel = e.target;
                            cy.elements().removeClass("semitransp");
                            sel.removeClass("highlight").outgoers().removeClass("highlight");
                        });

                        // Node Tap Event (if needed)
                        cy.on("tap", "node", function (e) {
                            // Navigate to profile (commented out by default)
                            // navigate(`${paths.profile}/${e.target.id()}`);
                        });

                        // **Prevent Overlap on Drag**
                        cy.on("dragfree", "node", (evt) => {
                            let node = evt.target;
                            let minDistance = 200; // Adjust based on node size

                            cy.nodes().forEach((otherNode) => {
                                if (node.id() !== otherNode.id()) {
                                    let dx = node.position("x") - otherNode.position("x");
                                    let dy = node.position("y") - otherNode.position("y");
                                    let distance = Math.sqrt(dx * dx + dy * dy);

                                    if (distance < minDistance) {
                                        // Calculate a new position to push node away
                                        let angle = Math.atan2(dy, dx);
                                        node.position({
                                            x: otherNode.position("x") + Math.cos(angle) * minDistance,
                                            y: otherNode.position("y") + Math.sin(angle) * minDistance,
                                        });
                                    }
                                }
                            });
                        });
                    }}
                    layout={layout}
                    elements={elements}
                    style={{ width: "90vw", height: "100vh" }}
                    stylesheet={cytoscapeStylesheet}
                    zoomingEnabled={true}
                    userZoomingEnabled={true}
                    minZoom={0.1}
                    maxZoom={10}
                    wheelSensitivity={0.1}
                /> */}

                <ForceGraph2D
                    linkDirectionalParticles={2}
                    linkDirectionalParticleWidth={1.5}    
                    linkColor={(link) => "white"}
                    // d3Force("link", (link) => {
                    //     link.distance = 200; // Increase edge length
                    // })
                    d3VelocityDecay={0.2}
                    graphData={graphData}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const x = node.x;
                        const y = node.y;
                        const fontSize = 12 / globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";

                        // Draw category as circle
                        if (node.type === "category") {
                        ctx.beginPath();
                        ctx.arc(x, y, 20, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.fill();
                        ctx.stroke();
                        }
                        // Draw post as rectangle
                        else if (node.type === "post") {
                        ctx.fillStyle = node.color;
                        ctx.fillRect(x - 30, y - 15, 60, 30);
                        ctx.strokeRect(x - 30, y - 15, 60, 30);
                        }
                        
                        // Draw label inside node
                        ctx.fillStyle = "white";
                        ctx.fillText(node.label, x, y);
                    }}
                />

            </div>
            
        </div>
    );
}

export default GraphProfile

// import React, { useRef, useEffect } from "react";
// import {ForceGraph2D} from "react-force-graph";
// import * as d3 from "d3";

// const graphData = {
//   nodes: [
//     { id: "1", group: 1, label: "Alice" },
//     { id: "2", group: 1, label: "Bob" },
//     { id: "3", group: 1, label: "Charlie" },
//     { id: "4", group: 2, label: "David" },
//     { id: "5", group: 2, label: "Eve" },
//     { id: "6", group: 2, label: "Frank" },
//     { id: "7", group: 3, label: "Grace" },
//     { id: "8", group: 3, label: "Hank" },
//     { id: "9", group: 3, label: "Ivy" },
//   ],
//   links: [
//     { source: "1", target: "2" },
//     { source: "2", target: "3" },
//     { source: "4", target: "5" },
//     { source: "5", target: "6" },
//     { source: "7", target: "8" },
//     { source: "8", target: "9" },
//   ],
// };

// export default function ClusterGraph() {
//   const graphRef = useRef();

//   useEffect(() => {
//     if (!graphRef.current) return;

//     const graph = graphRef.current;

//     // Delay force application to ensure nodes exist
//     setTimeout(() => {
//       graph.d3Force("charge", d3.forceManyBody().strength(-300));

//       // Apply clustering forces to group nodes together
//       graph.d3Force(
//         "x",
//         d3.forceX().strength(0.1).x((node) => node.group * 200)
//       );
//       graph.d3Force(
//         "y",
//         d3.forceY().strength(0.1).y((node) => node.group * 200)
//       );

//       // Ensure links are processed only after nodes exist
//       graph.d3Force(
//         "link",
//         d3.forceLink(graphData.links).id((d) => d.id).distance(100)
//       );

//       graph.d3ReheatSimulation(); // Restart simulation
//     }, 100); // Short delay to ensure nodes are initialized
//   }, []);

//   return (
//     <div style={{ width: "100vw", height: "100vh" }}>
//       <ForceGraph2D
//         ref={graphRef}
//         graphData={graphData}
//         nodeAutoColorBy="group"
//         d3VelocityDecay={0.2}
//         linkColor={(link) => "white"}
//         nodeCanvasObject={(node, ctx, globalScale) => {
//           const radius = 12;
//           const x = node.x;
//           const y = node.y;

//           // Draw node (circle)
//           ctx.beginPath();
//           ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
//           ctx.fillStyle = node.color || "gray";
//           ctx.fill();
//           ctx.strokeStyle = "black";
//           ctx.lineWidth = 1.5;
//           ctx.stroke();

//         //   // Draw label text
//         //   ctx.font = `${12 / globalScale}px Sans-Serif`;
//         //   ctx.fillStyle = "white";
//         //   ctx.textAlign = "center";
//         //   ctx.fillText(node.label, x, y + radius + 12);

//         ctx.font = `${12 / globalScale}px Sans-Serif`;
//         ctx.fillStyle = "black"; // Text color
//         ctx.textAlign = "center";
//         ctx.textBaseline = "middle";
//         ctx.fillText(node.label, x, y); // Centered text
//         }}
//         onNodeDragEnd={(node) => {
//           node.fx = node.x;
//           node.fy = node.y;
//         }}
//       />
//     </div>
//   );
// }
// import React, { useEffect, useState, useRef } from "react";
// import { ForceGraph2D } from "react-force-graph";
// import * as d3 from "d3";

// export default function CategoryPostGraph() {
//   const [graphData, setGraphData] = useState({ nodes: [], links: [] });
//   const graphRef = useRef();

//   const categories = ["Technology", "Science", "Sports"];
//   const posts = [
//     { id: "Post1", content: "AI advancements", categories: ["Technology", "Science"] },
//     { id: "Post2", content: "New discovery in physics", categories: ["Science"] },
//     { id: "Post3", content: "Soccer World Cup", categories: ["Sports"] },
//     { id: "Post4", content: "Quantum Computing", categories: ["Technology", "Science"] },
//   ];

//   useEffect(() => {
//         if (!graphRef.current) return;
    
//         const graph = graphRef.current;
    
//         // Delay force application to ensure nodes exist
//         setTimeout(() => {
//           graph.d3Force("charge", d3.forceManyBody().strength(-300));
    
//           // Apply clustering forces to group nodes together
//           graph.d3Force(
//             "x",
//             d3.forceX().strength(0.1).x((node) => node.group * 200)
//           );
//           graph.d3Force(
//             "y",
//             d3.forceY().strength(0.1).y((node) => node.group * 200)
//           );
    
//           // Ensure links are processed only after nodes exist
//           graph.d3Force(
//             "link",
//             d3.forceLink(graphData.links).id((d) => d.id).distance(100)
//           );
    
//           graph.d3ReheatSimulation(); // Restart simulation
//         }, 100); // Short delay to ensure nodes are initialized
//       }, []);

//   useEffect(() => {
//     const nodes = [];
//     const links = [];

//     categories.forEach((category) => {
//       nodes.push({ id: category, type: "category", color: "blue", label: category });
//     });

//     posts.forEach((post) => {
//       nodes.push({ id: post.id, type: "post", content: post.content, color: "orange", label: post.content });
//       post.categories.forEach((category) => {
//         links.push({ source: post.id, target: category });
//       });
//     });

//     setGraphData({ nodes, links });
//   }, []);

//   return (
//     <div style={{ width: "100vw", height: "100vh" }}>
//         <ForceGraph2D
//             linkDirectionalParticles={2}
//             linkDirectionalParticleWidth={1.5}    
//             linkColor={(link) => "white"}
//             // d3Force("link", (link) => {
//             //     link.distance = 200; // Increase edge length
//             // })
//             d3VelocityDecay={0.2}
//             graphData={graphData}
//             nodeCanvasObject={(node, ctx, globalScale) => {
//                 const x = node.x;
//                 const y = node.y;
//                 const fontSize = 12 / globalScale;
//                 ctx.font = `${fontSize}px Sans-Serif`;
//                 ctx.textAlign = "center";
//                 ctx.textBaseline = "middle";

//                 // Draw category as circle
//                 if (node.type === "category") {
//                 ctx.beginPath();
//                 ctx.arc(x, y, 20, 0, 2 * Math.PI, false);
//                 ctx.fillStyle = node.color;
//                 ctx.fill();
//                 ctx.stroke();
//                 }
//                 // Draw post as rectangle
//                 else if (node.type === "post") {
//                 ctx.fillStyle = node.color;
//                 ctx.fillRect(x - 30, y - 15, 60, 30);
//                 ctx.strokeRect(x - 30, y - 15, 60, 30);
//                 }
                
//                 // Draw label inside node
//                 ctx.fillStyle = "white";
//                 ctx.fillText(node.label, x, y);
//             }}
//         />
//     </div>
    
//     );
// }
