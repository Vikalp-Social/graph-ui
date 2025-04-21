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
        if (graphData.nodes.length > 0) {
            const width = graphRef.current.clientWidth;
            const height = 400;

            // Clear previous visualization
            d3.select(graphRef.current).selectAll("*").remove();

            // Create SVG
            const svg = d3.select(graphRef.current)
                .append("svg")
                .attr("width", width)
                .attr("height", height);

            // Create zoom behavior
            const zoom = d3.zoom()
                .scaleExtent([0.1, 4])
                .on("zoom", (event) => {
                    g.attr("transform", event.transform);
                });

            svg.call(zoom);

            // Create a group for the graph
            const g = svg.append("g");

            // Create force simulation
            const simulation = d3.forceSimulation(graphData.nodes)
                .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collision", d3.forceCollide().radius(50));

            // Create links
            const link = g.append("g")
                .selectAll("line")
                .data(graphData.links)
                .join("line")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.6)
                .attr("stroke-width", 1);

            // Create nodes
            const node = g.append("g")
                .selectAll("g")
                .data(graphData.nodes)
                .join("g")
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));

            // Add circles for nodes
            node.append("circle")
                .attr("r", d => d.type === "category" ? 20 : 30)
                .attr("fill", d => d.color || "#1da1f2")
                .attr("stroke", "#fff")
                .attr("stroke-width", 2);

            // Add labels for nodes
            node.append("text")
                .text(d => d.label)
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .attr("fill", "#fff")
                .style("font-size", "12px")
                .style("pointer-events", "none");

            // Update positions on each tick
            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node.attr("transform", d => `translate(${d.x},${d.y})`);
            });

            // Drag functions
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }

            // Cleanup
            return () => {
                simulation.stop();
            };
        }
    }, [graphData]);

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

                <div ref={graphRef} style={{ width: '100%', height: '400px' }}></div>

            </div>
            
        </div>
    );
}

export default GraphProfile;