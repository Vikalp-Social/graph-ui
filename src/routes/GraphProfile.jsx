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
        if (!graphRef.current) return;

        const graph = graphRef.current;

        // Delay force application to ensure nodes exist
        setTimeout(() => {
            // graph.d3Force("charge", d3.forceManyBody().strength(-300));

            // // Apply clustering forces to group nodes together
            // graph.d3Force(
            // "x",
            // d3.forceX().strength(0.1).x((node) => node.group * 200)
            // );
            // graph.d3Force(
            // "y",
            // d3.forceY().strength(0.1).y((node) => node.group * 200)
            // );

            // // Ensure links are processed only after nodes exist
            // graph.d3Force(
            // "link",
            // d3.forceLink(graphData.links).id((d) => d.id).distance(100)
            // );

            // graph.d3ReheatSimulation(); // Restart simulation

            graph.d3Force("charge", d3.forceManyBody().strength(-300));
            graph.d3Force("x", d3.forceX().strength(0.1).x((node) => node.group * 200));
            graph.d3Force("y", d3.forceY().strength(0.1).y((node) => node.group * 200));
            graph.d3Force("link", d3.forceLink(graphData.links).id((d) => d.id).distance(500));
            graph.d3ReheatSimulation();
        }, 100); // Short delay to ensure nodes are initialized
    }, []);

    useEffect(() => {
        document.title = `${user.display_name || user.username} (@${user.username === user.acct ? `${user.username}@${currentUser.instance}` : user.acct}) | Vikalp`;
    });

    useEffect(() => {
        const cleanAndProcessData = async () => {
            try {
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

                    // console.log(newelements);

                    statuses.cluster[category].elements.forEach((post) => {
                        // Ensure the post node exists
                        //console.log(post.id);
                        if (!newelements.some((el) => el.id === post.id)) {
                            let content = trimString(post.content.replace(/(<([^>]+)>)/gi, "").replace("&#39;", "'"), 60);
                            newelements.push({ 
                                id: post.id, type: "post", label: content, color: "orange", content: content
                            });
                        };

                        cluster.push(post.id);

                        // console.log(newelements);
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

                // console.log(newelements);
                // console.log(links);
                setGraphData({ nodes: newelements, links });

                setElements([...newelements]);
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
                        const fontSize = 12;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";

                        if (node.type === "category") {
                            ctx.beginPath();
                            ctx.arc(x, y, 20, 0, 2 * Math.PI, false);
                            ctx.fillStyle = node.color;
                            ctx.fill();
                            ctx.stroke();
                            ctx.fillStyle = "white";
                            ctx.fillText(node.label, x, y);
                        } else if (node.type === "post") {
                            const padding = 5;
                            const maxWidth = 100;
                            const textLines = [];
                            let tempText = "";
                            node.label.split(" ").forEach((word) => {
                            const testLine = tempText + (tempText ? " " : "") + word;
                            const testWidth = ctx.measureText(testLine).width;
                            if (testWidth > maxWidth) {
                                textLines.push(tempText);
                                tempText = word;
                            } else {
                                tempText = testLine;
                            }
                            });
                            textLines.push(tempText);

                            const textHeight = textLines.length * fontSize + padding * 2;
                            const rectWidth = maxWidth + padding * 2;
                            const rectHeight = textHeight;
                            
                            ctx.fillStyle = node.color;
                            ctx.fillRect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight);
                            ctx.strokeRect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight);
                            
                            ctx.fillStyle = "white";
                            textLines.forEach((line, i) => {
                            ctx.fillText(line, x, y - rectHeight / 2 + padding + i * fontSize);
                            });
                        }
                    }}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        ctx.fillStyle = color;
                        if (node.type === "category") {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI, false);
                            ctx.fill();
                        } else if (node.type === "post") {
                            const padding = 5;
                            const maxWidth = 100;
                            const fontSize = 12;
                            const textLines = [];
                            let tempText = "";

                            node.label.split(" ").forEach((word) => {
                            const testLine = tempText + (tempText ? " " : "") + word;
                            const testWidth = ctx.measureText(testLine).width;
                            if (testWidth > maxWidth) {
                                textLines.push(tempText);
                                tempText = word;
                            } else {
                                tempText = testLine;
                            }
                            });
                            textLines.push(tempText);

                            const textHeight = textLines.length * fontSize + padding * 2;
                            const rectWidth = maxWidth + padding * 2;
                            const rectHeight = textHeight;

                            ctx.fillRect(node.x - rectWidth / 2, node.y - rectHeight / 2, rectWidth, rectHeight);
                        }
                    }}

                />

            </div>
            
        </div>
    );
}

export default GraphProfile;