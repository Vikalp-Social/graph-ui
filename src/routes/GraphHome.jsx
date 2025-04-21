import React, { useEffect, useRef, useState, useContext } from "react";
import * as d3 from "d3";
import { UserContext } from "../context/UserContext";
import Navbar from "../components/Navbar";
import APIClient from "../apis/APIClient";
import DOMPurify from "dompurify";
import { FaRegComment, FaHeart, FaRegHeart, FaRepeat, FaShare } from "react-icons/fa6";
import { MdOutlineRepeat } from "react-icons/md";
import UsernameEmoji from "../components/UsernameEmoji";
import MediaDisplay from "../components/MediaDisplay";
import Reply from "../components/Reply";

// Function to fetch and transform data from API
const fetchAndTransformData = async (token) => {
  const baseUrl = `http://localhost:5000/api/v1/timelines/home?instance=mastodon.social&token=${token}`;

  try {
    const response1 = await fetch(`${baseUrl}&limit=40&max_id=`);

    if (!response1.ok) throw new Error('Network response was not ok (first fetch)');
    const json1 = await response1.json();

    const transformed1 = transformData(json1);

    const maxId = json1.max_id;

    if (!maxId) {
      console.warn('No max_id found from first fetch, returning only first batch');
      return transformed1;
    }

    const response2 = await fetch(`${baseUrl}&limit=40&max_id=${maxId}`);

    if (!response2.ok) throw new Error('Network response was not ok (second fetch)');
    const json2 = await response2.json();

    const transformed2 = transformData(json2);

    return [...transformed1, ...transformed2];

  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
};

// Function to transform the data into the desired format
const transformData = (inputData) => {
  const colors = ["red", "blue", "green", "purple", "orange", "cyan", "pink", "yellow", "brown", "teal"];
  const imageUrls = [
    "https://randomuser.me/api/portraits/men/1.jpg",
    "https://randomuser.me/api/portraits/women/2.jpg",
    "https://randomuser.me/api/portraits/men/3.jpg",
    "https://randomuser.me/api/portraits/women/4.jpg",
    "https://randomuser.me/api/portraits/men/5.jpg",
    "https://randomuser.me/api/portraits/women/6.jpg",
    "https://randomuser.me/api/portraits/men/7.jpg",
    "https://randomuser.me/api/portraits/women/8.jpg",
    "https://randomuser.me/api/portraits/men/9.jpg",
    "https://randomuser.me/api/portraits/women/10.jpg",
  ];

  const transformedData = [];

  for (const topic in inputData.cluster) {
    console.log(topic);
    const clusterData = inputData.cluster[topic];

    console.log(clusterData);
    clusterData.elements.forEach((element, i) => {
      console.log(element);
      transformedData.push({
        id: element.id,
        post_id: `${topic}-${i}`,
        size: 30,
        color: colors[Object.keys(inputData.cluster).indexOf(topic) % colors.length],
        cluster: topic,
        // Store the complete status object
        status: element
      });
    });
  }

  return transformedData;
};

// Fallback data generation function
const generateData = (numClusters, numBubbles) => {
  const topics = ["Tech", "Science", "Health", "Sports", "Music", "AI", "Education", "Gaming", "Finance", "Movies"];
  const colors = ["red", "blue", "green", "purple", "orange", "cyan", "pink", "yellow", "brown", "teal"];
  
  const imageUrls = [
    "https://randomuser.me/api/portraits/men/1.jpg",
    "https://randomuser.me/api/portraits/women/2.jpg",
    "https://randomuser.me/api/portraits/men/3.jpg",
    "https://randomuser.me/api/portraits/women/4.jpg",
    "https://randomuser.me/api/portraits/men/5.jpg",
    "https://randomuser.me/api/portraits/women/6.jpg",
    "https://randomuser.me/api/portraits/men/7.jpg",
    "https://randomuser.me/api/portraits/women/8.jpg",
    "https://randomuser.me/api/portraits/men/9.jpg",
    "https://randomuser.me/api/portraits/women/10.jpg",
  ];

  let data = [];

  for (let cluster = 0; cluster < numClusters; cluster++) {
    for (let i = 0; i < numBubbles; i++) {
      data.push({
        id: `${topics[cluster]}-${i}`,
        size: Math.random() * 20 + 10,
        color: colors[cluster % colors.length],
        cluster: topics[cluster],
        content: `This is a post about Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatis vitae, justo. Nulla ${topics[cluster]} #${i + 1}`,
        image: imageUrls[(i + cluster) % imageUrls.length],
      });
    }
  }
  return data;
};

const GraphHome = () => {
  const { currentUser } = useContext(UserContext);
  const svgRef = useRef();
  const simulationRef = useRef(null);
  const layoutRef = useRef(null);
  const zoomRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [hoverAccount, setHoverAccount] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(checkIfMobile());
  const [centerPreview, setCenterPreview] = useState(null);
  const longPressTimer = useRef(null);
  const interactionType = useRef(null);
  const touchStartPos = useRef(null);
  const lastTransform = useRef({ x: 0, y: 0, k: 1 });
  const [viewedPosts, setViewedPosts] = useState(new Set());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const theme = localStorage.getItem("selectedTheme");
  const [statusData, setStatusData] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [hoverNode, setHoverNode] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Try to fetch data from API using token from currentUser
        const apiData = await fetchAndTransformData(currentUser.token);
        
        // If API data is empty or undefined, use fallback data
        if (!apiData || apiData.length === 0) {
          console.log("Using fallback data");
          setData(generateData(10, 30));
        } else {
          setData(apiData);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message);
        // Use fallback data in case of error
        setData(generateData(10, 30));
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.token) {
      loadData();
    } else {
      setError("No authentication token available");
      setLoading(false);
    }
  }, [currentUser]);

  // Function to check if device is mobile
  function checkIfMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
    return isMobileDevice || window.innerWidth <= 768;
  }

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      setIsMobile(checkIfMobile());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle profile selection
  const handleProfileSelect = (profile) => {
    setSelectedProfile(profile);
    setIsSidebarVisible(true);
    setShowSidebar(true);
    // Add the post to viewed posts
    setViewedPosts(prev => new Set([...prev, profile.id]));
    // Update statusData directly from the stored status object
    setStatusData(profile);
    // Fetch replies for the selected status
    if (profile && profile.id) {
      fetchReplies(profile.id);
    }
  };

  // Function to fetch only replies for a status
  const fetchReplies = async (statusId) => {
    if (!statusId) return;
    
    try {
      setLoadingStatus(true);
      const response = await APIClient.get(`/statuses/${statusId}`, {
        params: {
          instance: currentUser.instance,
          token: currentUser.token,
        }
      });
      // Only update the replies, keep the existing status data
      setReplies(response.data.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
      setReplies([]);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Initialize layout once
  useEffect(() => {
    const { width, height } = dimensions;
    const clusters = [...new Set(data.map((d) => d.cluster))];

    // Count bubbles per cluster
    const clusterCounts = clusters.reduce((acc, cluster) => {
      acc[cluster] = data.filter(d => d.cluster === cluster).length;
      return acc;
    }, {});

    // Group data by cluster and then by account_id
    const groupedData = clusters.reduce((acc, cluster) => {
      const clusterData = data.filter(d => d.cluster === cluster);
      const accountGroups = {};
      
      // Group all posts by account_id
      clusterData.forEach(d => {
        if (!accountGroups[d.status.account.id]) {
          accountGroups[d.status.account.id] = [];
        }
        accountGroups[d.status.account.id].push(d);
      });
      
      // Add dummy post for single-post accounts
      Object.entries(accountGroups).forEach(([accountId, posts]) => {
        if (posts.length === 1) {
          const dummyPost = {
            ...posts[0],
            post_id: `dummy-${posts[0].post_id}`,
            isDummy: true,
            x: posts[0].x,
            y: posts[0].y
          };
          accountGroups[accountId].push(dummyPost);
          // Add dummy post to data array for force simulation
          data.push(dummyPost);
        }
      });
      
      acc[cluster] = accountGroups;
      return acc;
    }, {});

    // Initialize cluster centers with radius based on total accounts
    const clusterCenters = clusters.map((c) => ({
      cluster: c,
      x: Math.random() * (width - 600) + 300,
      y: Math.random() * (height - 200) + 100,
      radius: 80 + (Object.keys(groupedData[c]).length * 25),
      accountGroups: groupedData[c]
    }));

    // Initialize force simulation for clusters
    const simulation = d3.forceSimulation(clusterCenters)
      .force("x", d3.forceX(width / 2).strength(1.0))
      .force("y", d3.forceY(height / 2).strength(1.0))
      .force("collision", d3.forceCollide().radius(d => d.radius + 20).strength(1.0))
      .velocityDecay(0.1); // Reduced for more immediate response

    // Run simulation synchronously
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }
    simulation.stop();

    // Store the layout data
    layoutRef.current = {
      clusterCenters,
      width,
      height
    };

    // Initialize profile simulation with immediate response parameters
    simulationRef.current = d3.forceSimulation(data)
      .force("x", d3.forceX((d) => {
        const cluster = clusterCenters.find((c) => c.cluster === d.cluster);
        const accountGroup = Object.values(cluster.accountGroups).find(group => 
          group.some(item => item.status.account.id === d.status.account.id)
        );
        
        // Calculate account center position
        const accountIndex = Object.keys(cluster.accountGroups).indexOf(d.status.account.id);
        const totalAccounts = Object.keys(cluster.accountGroups).length;
        const accountAngle = (accountIndex * (Math.PI * 2) / totalAccounts);
        const accountDistance = cluster.radius * 0.4;
        const accountCenterX = cluster.x + Math.cos(accountAngle) * accountDistance;
        
        // Position posts in a circle around account center
        const postIndex = accountGroup.indexOf(d);
        const totalPosts = accountGroup.length;
        const angle = (postIndex * (Math.PI * 2) / totalPosts);
        const radius = 40; // Fixed radius for post circle
        return accountCenterX + Math.cos(angle) * radius;
      }).strength(1)) // Increased strength for immediate response
      .force("y", d3.forceY((d) => {
        const cluster = clusterCenters.find((c) => c.cluster === d.cluster);
        const accountGroup = Object.values(cluster.accountGroups).find(group => 
          group.some(item => item.status.account.id === d.status.account.id)
        );
        
        // Calculate account center position
        const accountIndex = Object.keys(cluster.accountGroups).indexOf(d.status.account.id);
        const totalAccounts = Object.keys(cluster.accountGroups).length;
        const accountAngle = (accountIndex * (Math.PI * 2) / totalAccounts);
        const accountDistance = cluster.radius * 0.4;
        const accountCenterY = cluster.y + Math.sin(accountAngle) * accountDistance;
        
        // Position posts in a circle around account center
        const postIndex = accountGroup.indexOf(d);
        const totalPosts = accountGroup.length;
        const angle = (postIndex * (Math.PI * 2) / totalPosts);
        const radius = 40; // Fixed radius for post circle
        return accountCenterY + Math.sin(angle) * radius;
      }).strength(1)) // Increased strength for immediate response
      .force("collision", d3.forceCollide().radius(d => d.isDummy ? 3 : 8).strength(1)) // Increased collision strength
      .velocityDecay(0.1); // Reduced damping for immediate response

    // Run profile simulation synchronously
    for (let i = 0; i < 300; i++) {
      simulationRef.current.tick();
    }
    simulationRef.current.stop();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [data, dimensions]);

  // Function to find the bubble closest to the center
  const findClosestToCenter = (data, width, height) => {
    if (!data || data.length === 0) return null;
    
    // Use the center of the current view, not the graph
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Transform the center coordinates based on the current zoom/pan
    const transformedCenterX = (centerX - lastTransform.current.x) / lastTransform.current.k;
    const transformedCenterY = (centerY - lastTransform.current.y) / lastTransform.current.k;
    
    return data.reduce((closest, current) => {
      const currentDist = Math.sqrt(
        Math.pow(current.x - transformedCenterX, 2) + 
        Math.pow(current.y - transformedCenterY, 2)
      );
      
      const closestDist = closest ? Math.sqrt(
        Math.pow(closest.x - transformedCenterX, 2) + 
        Math.pow(closest.y - transformedCenterY, 2)
      ) : Infinity;
      
      return currentDist < closestDist ? current : closest;
    }, null);
  };

  // Update center preview on simulation tick
  useEffect(() => {
    if (!simulationRef.current || !isMobile) return;

    const updateCenterPreview = () => {
      const { width, height } = dimensions;
      const closest = findClosestToCenter(data, width, height);
      setCenterPreview(closest);
    };

    // Update preview immediately
    updateCenterPreview();
    
    // Check if the simulation has an 'on' method before using it
    if (typeof simulationRef.current.on === 'function') {
      simulationRef.current.on("tick", updateCenterPreview);
      return () => {
        if (simulationRef.current && typeof simulationRef.current.off === 'function') {
          simulationRef.current.off("tick", updateCenterPreview);
        }
      };
    }
  }, [data, dimensions, isMobile]);

  // Add a separate effect to update the preview when panning
  useEffect(() => {
    if (!isMobile) return;
    
    const updatePreview = () => {
      const { width, height } = dimensions;
      const closest = findClosestToCenter(data, width, height);
      setCenterPreview(closest);
    };
    
    // Update preview on a timer to ensure it's visible
    const previewTimer = setInterval(updatePreview, 200);
    
    // Also update immediately
    updatePreview();
    
    return () => {
      clearInterval(previewTimer);
    };
  }, [data, dimensions, isMobile]);

  // Render visualization
  useEffect(() => {
    if (!layoutRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dimensions;
    const effectiveWidth = width - (!isMobile && isSidebarVisible ? 400 : 0);
    
    const svg = d3
      .select(svgRef.current)
      .attr("width", effectiveWidth)
      .attr("height", height);

    // Create the main group element first
    const g = svg.append("g");
    if (lastTransform.current) {
      g.attr("transform", lastTransform.current);
    }

    // Initialize zoom behavior for immediate response
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        lastTransform.current = event.transform;
        g.attr("transform", event.transform);
        // Update preview when panning
        if (isMobile) {
          const closest = findClosestToCenter(data, width, height);
          setCenterPreview(closest);
        }
      });

    zoomRef.current = zoom;
    
    // Apply zoom to svg and restore previous transform if it exists
    svg.call(zoom);
    if (lastTransform.current) {
      svg.call(zoom.transform, d3.zoomIdentity
        .translate(lastTransform.current.x, lastTransform.current.y)
        .scale(lastTransform.current.k)
      );
    }

    // Add touch event handlers for mobile with immediate response
    if (isMobile) {
      svg
        .on("touchstart", (event) => {
          event.preventDefault();
          touchStartPos.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            transform: lastTransform.current
          };
        })
        .on("touchmove", (event) => {
          if (!touchStartPos.current) return;
          event.preventDefault();
          
          const dx = event.touches[0].clientX - touchStartPos.current.x;
          const dy = event.touches[0].clientY - touchStartPos.current.y;
          
          const newTransform = {
            ...touchStartPos.current.transform,
            x: touchStartPos.current.transform.x + dx,
            y: touchStartPos.current.transform.y + dy
          };
          
          // Apply transform immediately without any delay
          svg.call(zoom.transform, d3.zoomIdentity
            .translate(newTransform.x, newTransform.y)
            .scale(newTransform.k)
          );
          
          // Update preview during pan
          const { width, height } = dimensions;
          const closest = findClosestToCenter(data, width, height);
          setCenterPreview(closest);
        })
        .on("touchend", () => {
          touchStartPos.current = null;
        });
    }

    const { clusterCenters } = layoutRef.current;

    // Draw cluster boundaries with theme-aware colors
    g.selectAll(".cluster-circle")
      .data(clusterCenters)
      .enter()
      .append("circle")
      .attr("class", "cluster-circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.radius)
      .style("fill", "none")
      .style("stroke", theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)")
      .style("stroke-dasharray", "5,5");

    // Draw account group boundaries with theme-aware colors
    const accountGroups = g.selectAll(".account-group")
      .data(clusterCenters)
      .enter()
      .selectAll(".account-subgroup")
      .data(d => Object.entries(d.accountGroups)
        .map(([accountId, group]) => ({
          accountId,
          group,
          cluster: d.cluster,
          x: d.x,
          y: d.y
        })))
      .enter()
      .append("g")
      .attr("class", "account-subgroup");

    // Add account identifier group with larger profile picture
    const accountIdentifiers = accountGroups
      .append("g")
      .attr("class", "account-identifier");

    // Add white background circle for account image with theme-aware colors
    accountIdentifiers
      .append("circle")
      .attr("cx", d => {
        const centerX = d.group.reduce((sum, item) => sum + item.x, 0) / d.group.length;
        return centerX;
      })
      .attr("cy", d => {
        const centerY = d.group.reduce((sum, item) => sum + item.y, 0) / d.group.length;
        return centerY;
      })
      .attr("r", 25)
      .style("fill", theme === "dark" ? "hsl(var(--status_background))" : "white")
      .style("stroke", theme === "dark" ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)")
      .style("stroke-width", "2px");

    // Add account image
    accountIdentifiers
      .append("foreignObject")
      .attr("x", d => {
        const centerX = d.group.reduce((sum, item) => sum + item.x, 0) / d.group.length;
        return centerX - 25;
      })
      .attr("y", d => {
        const centerY = d.group.reduce((sum, item) => sum + item.y, 0) / d.group.length;
        return centerY - 25;
      })
      .attr("width", 50)
      .attr("height", 50)
      .append("xhtml:img")
      .attr("src", d => d.group[0].status.account.avatar)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("border-radius", "50%")
      .style("object-fit", "cover");

    // Add account hover events
    accountIdentifiers
      .on("mouseenter", (event, d) => {
        if (!isMobile) {
          setMousePosition({ x: event.clientX, y: event.clientY });
          setHoverAccount({
            id: d.group[0].status.account.id,
            content: d.group[0].status.content,
            image: d.group[0].status.account.avatar,
            name: d.group[0].status.account.display_name || d.group[0].status.account.username,
            accountId: d.group[0].status.account.username,
            date: d.group[0].status.created_at,
            followers: d.group[0].status.account.followers_count || 0,
            posts: d.group.length
          });
        }
      })
      .on("mousemove", (event) => {
        if (!isMobile) {
          setMousePosition({ x: event.clientX, y: event.clientY });
        }
      })
      .on("mouseleave", () => {
        if (!isMobile) {
          setHoverAccount(null);
        }
      })
      .on("click", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        setHoverPreview(null);
        // Open account in a new tab instead of showing post
        window.open(`${window.location.origin}/profile/${d.group[0].status.account.id}`, '_blank');
      });

    // Draw profiles with different colors for same account
    const profileGroups = g
      .selectAll(".profile-group")
      .data(data) // Keep all posts including dummy ones
      .enter()
      .append("g")
      .attr("class", "profile-group")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Add touch and mouse events
    profileGroups
      .filter(d => !d.isDummy) // Only add interaction events to real posts
      .on("touchstart", (event, d) => {
        // Only handle touch events if we're not panning
        if (touchStartPos.current) return;
        
        event.preventDefault();
        event.stopPropagation();
        setHoverPreview(null);
        interactionType.current = null;
        
        longPressTimer.current = setTimeout(() => {
          setHoverPreview(d);
          interactionType.current = 'longpress';
        }, 500);
      })
      .on("touchend", (event, d) => {
        // Only handle touch events if we're not panning
        if (touchStartPos.current) return;
        
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(longPressTimer.current);
        
        if (interactionType.current === 'longpress') {
          handleProfileSelect(d.status);
        } else {
          // Handle tap/click on mobile
          handleProfileSelect(d.status);
        }
        interactionType.current = null;
      })
      .on("touchmove", (event) => {
        // Only handle touch events if we're not panning
        if (touchStartPos.current) return;
        
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(longPressTimer.current);
        setHoverPreview(null);
        interactionType.current = null;
      })
      .on("mouseenter", (event, d) => {
        if (!isMobile) {
          setMousePosition({ x: event.clientX, y: event.clientY });
          setHoverPreview(d);
        }
      })
      .on("mousemove", (event) => {
        if (!isMobile && hoverPreview) {
          setMousePosition({ x: event.clientX, y: event.clientY });
        }
      })
      .on("mouseleave", () => {
        if (!isMobile) {
          setHoverPreview(null);
        }
      })
      .on("click", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        setHoverPreview(null);
        handleProfileSelect(d.status);
      });

    // Draw colored circles for profiles
    profileGroups
      .append("circle")
      .attr("r", d => d.isDummy ? 0 : Math.min(d.size * 0.4, 8)) // Zero radius for dummy posts
      .attr("fill", d => {
        if (d.isDummy) {
          return "transparent"; // Transparent fill for dummy posts
        }
        const accountColor = d3.color(d3.interpolateRainbow(
          (parseInt(d.status.account.id, 36) % 20) / 20
        ));
        accountColor.opacity = viewedPosts.has(d.status.id) ? 0.15 : 0.8;
        return accountColor;
      })
      .style("stroke", d => d.isDummy ? "none" : "#fff")
      .style("stroke-width", "1px")
      .style("pointer-events", d => d.isDummy ? "none" : "auto"); // Disable pointer events for dummy posts

    // Draw cluster labels with theme-aware colors
    g.selectAll(".cluster-label")
      .data(clusterCenters)
      .enter()
      .append("text")
      .attr("class", "cluster-label")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y - d.radius - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .style("fill", theme === "dark" ? "var(--text_color)" : "var(--text_color)")
      .text((d) => d.cluster);

    // Update profile group positions during simulation tick
    simulationRef.current.on("tick", () => {
      // Immediate position updates without transitions
      profileGroups.attr("transform", d => `translate(${d.x},${d.y})`);
      accountGroups.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Add a magnifying glass effect for mobile
    if (isMobile) {
      console.log("Initializing magnifying glass for mobile");
      
      // Create a magnifying glass container
      const magnifier = svg.append("g")
        .attr("class", "magnifier")
        .style("display", "none");
      
      // Add a circle for the magnifying glass
      magnifier.append("circle")
        .attr("r", 50)
        .style("fill", "none")
        .style("stroke", theme === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)")
        .style("stroke-width", "4px");
      
      // Add a crosshair
      magnifier.append("line")
        .attr("x1", -20)
        .attr("y1", 0)
        .attr("x2", 20)
        .attr("y2", 0)
        .style("stroke", theme === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)")
        .style("stroke-width", "3px");
      
      magnifier.append("line")
        .attr("x1", 0)
        .attr("y1", -20)
        .attr("x2", 0)
        .attr("y2", 20)
        .style("stroke", theme === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)")
        .style("stroke-width", "3px");
      
      // Update magnifier position on touch move
      svg.on("touchmove", (event) => {
        if (event.touches.length === 1) {
          const touch = event.touches[0];
          const point = d3.pointer(event, svg.node());
          
          // Show the magnifier
          magnifier.style("display", null);
          
          // Position the magnifier at the touch point
          magnifier.attr("transform", `translate(${point[0]},${point[1]})`);
          
          // Find the closest node to the touch point
          const closest = findClosestToPoint(data, point[0], point[1]);
          if (closest) {
            setHoverPreview(closest);
          }
        }
      });
      
      // Hide magnifier on touch end
      svg.on("touchend", () => {
        magnifier.style("display", "none");
        setHoverPreview(null);
      });
    }

    // Add click event to nodes
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [data, dimensions, isSidebarVisible, isMobile, viewedPosts, theme]);

  // Helper function to find the closest node to a point
  const findClosestToPoint = (data, x, y) => {
    if (!data || data.length === 0) return null;
    
    // Transform the point coordinates based on the current zoom/pan
    const transformedX = (x - lastTransform.current.x) / lastTransform.current.k;
    const transformedY = (y - lastTransform.current.y) / lastTransform.current.k;
    
    return data.reduce((closest, current) => {
      if (current.isDummy) return closest;
      
      const currentDist = Math.sqrt(
        Math.pow(current.x - transformedX, 2) + 
        Math.pow(current.y - transformedY, 2)
      );
      
      const closestDist = closest ? Math.sqrt(
        Math.pow(closest.x - transformedX, 2) + 
        Math.pow(closest.y - transformedY, 2)
      ) : Infinity;
      
      return currentDist < closestDist ? current : closest;
    }, null);
  };

  const handleCloseSidebar = () => {
    setIsSidebarVisible(false);
    setSelectedProfile(null);
    
    // Reapply the last transform after a short delay to ensure DOM is updated
    setTimeout(() => {
      if (zoomRef.current && lastTransform.current) {
        const svg = d3.select(svgRef.current);
        svg.call(zoomRef.current.transform, d3.zoomIdentity
          .translate(lastTransform.current.x, lastTransform.current.y)
          .scale(lastTransform.current.k)
        );
      }
    }, 50);
  };

  // Add a separate effect to ensure mobile preview is visible
  useEffect(() => {
    if (isMobile && hoverPreview) {
      console.log("Mobile preview should be visible:", hoverPreview);
    }
  }, [hoverPreview, isMobile]);

  // Format data for display
  const formatData = (data) => {
    let message = data;
    if (data > 1000) {
      message = `${(data/1000).toFixed(2)}k`;
      data = data/1000;
      if (data > 100) message = `${Math.round(data)}k`;
    }
    return message;
  };

  // Format time for display
  const formatTime = (time) => {
    let date = new Date(time);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    });
  };

  // Handle user click to navigate to profile
  const handleUserClick = (event, id) => {
    event.stopPropagation();
    // Navigate to profile page
    window.open(`${window.location.origin}/profile/${id}`, '_blank');
  };

  // Render Status component
  const StatusComponent = ({ status, isReply = false, thread = false }) => {
    // State for interaction buttons - moved to top level
    const [isFavourite, setFavourite] = useState(status?.favourited || false);
    const [isBoosted, setBoosted] = useState(status?.reblogged || false);
    const [isReplying, setReplying] = useState(false);
    
    if (!status) return null;
    
    const sanitizedHtml = DOMPurify.sanitize(status.content);
    
    // Handle favorite button
    const handleFavourite = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        let prefix = status.favourited ? "un" : "";
        const response = await APIClient.post(`/statuses/${status.id}/favourite`, {
          instance: currentUser.instance,
          token: currentUser.token,
          prefix: prefix,
        });
        setFavourite(prev => {
          status.favourites_count = !prev ? status.favourites_count + 1 : status.favourites_count - 1;
          return !prev;
        });
      } catch (error) {
        console.error("Error favoriting status:", error);
      }
    };
    
    // Handle boost/repost button
    const handleBoost = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        let prefix = status.reblogged ? "un" : "";
        const response = await APIClient.post(`/statuses/${status.id}/boost`, {
          instance: currentUser.instance,
          token: currentUser.token,
          prefix: prefix,
        });
        setBoosted(prev => !prev);
      } catch (error) {
        console.error("Error boosting status:", error);
      }
    };
    
    // Handle reply button
    const handleReply = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setReplying(true);
    };
    
    // Handle share button
    const handleShare = (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigator.clipboard.writeText(status.uri);
      // You could show a toast notification here
    };
    
    return (
      <>
        <div className={isReply ? "reply" : "status"} style={{
          padding: "15px",
          marginBottom: "15px",
          borderRadius: "8px",
          background: theme === "dark" ? "hsl(var(--status_background))" : "white",
          border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
          paddingBottom: (isReply && thread) ? '0' : '10px'
        }}>
          {status.reblogged && (
            <div className="statusRepost" onClick={(event) => handleUserClick(event, status.account.id)} style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              marginBottom: "10px",
              color: "var(--text_color)",
              opacity: 0.7
            }}>
              <MdOutlineRepeat style={{color: "green", fontSize: "20px"}}/> 
              <span><strong><UsernameEmoji name={status.account.display_name || status.account.username} emojis={status.account.emojis} /></strong></span> 
              <span>reposted</span>
            </div>
          )}
          
          <div className="statusTop" style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px"
          }}>
            <div className="statusTopLeft" style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
              <img 
                className="statusProfileImg" 
                src={status.account.avatar} 
                alt="profile" 
                onClick={(event) => handleUserClick(event, status.account.id)}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  cursor: "pointer"
                }}
              />
              <div className="statusUser" style={{
                display: "flex",
                flexDirection: "column"
              }}>
                <span 
                  className="statusUsername" 
                  onClick={(event) => handleUserClick(event, status.account.id)}
                  style={{
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  <UsernameEmoji name={status.account.display_name || status.account.username} emojis={status.account.emojis} />
                </span>
                <span className="userInstance" style={{
                  fontSize: "0.8em",
                  opacity: 0.7
                }}>
                  {status.account.username === status.account.acct 
                    ? `${status.account.username}@${currentUser.instance}` 
                    : status.account.acct}
                </span>
              </div>
            </div>
          </div>
          
          <div className={thread ? "statusCenter" : ""} style={{
            position: "relative"
          }}>
            {(isReply && thread) && (
              <div className="reply-line-container" style={{
                position: "absolute",
                left: "-15px",
                top: 0,
                bottom: 0,
                width: "2px",
                background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"
              }}>
                <div className="reply-line"></div>
              </div>
            )}
            
            <div className="statusBody" style={{
              marginLeft: (isReply && thread) ? "15px" : "0"
            }}>
              <span className="statusText" style={{
                marginBottom: "10px",
                display: "block"
              }}>
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              </span>
              
              {status.media_attachments && status.media_attachments.length > 0 && (
                <MediaDisplay mediaList={status.media_attachments} />
              )}
              
              <div className="statusBottom" style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "15px",
                paddingTop: "10px",
                borderTop: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)"
              }}>
                <div className="statusBottomLeft" style={{
                  display: "flex",
                  gap: "15px"
                }}>
                  <div 
                    title="Reply" 
                    onClick={handleReply}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer"
                    }}
                  >
                    <FaRegComment/> 
                    <span className="stats">{formatData(status.replies_count || 0)}</span>
                  </div>
                  <div 
                    title="Repost" 
                    onClick={handleBoost}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      color: isBoosted ? "green" : ""
                    }}
                  >
                    <FaRepeat /> 
                    <span className="stats">{formatData(status.reblogs_count || 0)}</span>
                  </div>
                  <div 
                    title="Like" 
                    onClick={handleFavourite}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      color: isFavourite ? "red" : ""
                    }}
                  >
                    {isFavourite ? <FaHeart /> : <FaRegHeart />}
                    <span className="stats">{formatData(status.favourites_count || 0)}</span>
                  </div>
                </div>
                <div className="statusBottomRight" style={{
                  display: "flex",
                  gap: "15px"
                }}>
                  <div 
                    title="Share" 
                    onClick={handleShare}
                    style={{
                      cursor: "pointer"
                    }}
                  >
                    <FaShare />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Reply Modal */}
        {isReplying && (
          <Reply 
            show={isReplying} 
            close={() => setReplying(false)} 
            post={status}
            instance={currentUser.instance}
          />
        )}
      </>
    );
  };

  // Helper function to render status
  const renderStatus = (status, isReply = false, thread = false) => {
    return <StatusComponent status={status} isReply={isReply} thread={thread} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh" }}>
      <Navbar />
      {loading ? (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh",
          fontSize: "1.2rem",
          color: "var(--text_color)"
        }}>
          Loading visualization...
        </div>
      ) : error ? (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh",
          color: "red",
          padding: "20px",
          textAlign: "center"
        }}>
          Error: {error}
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          {/* Mobile Crosshair - Fixed at center of viewport */}
          {isMobile && (
            <div
              style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "60px",
                height: "60px",
                pointerEvents: "none",
                zIndex: 9999,
              }}
            >
              {/* Magnifying glass icon */}
              <svg 
                width="60" 
                height="60" 
                viewBox="0 0 40 40" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  filter: "drop-shadow(0px 0px 3px rgba(0,0,0,0.5))"
                }}
              >
                {/* Magnifying glass handle */}
                <path 
                  d="M24.5 24.5L32 32" 
                  stroke="rgba(255, 0, 0, 1)" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                />
                {/* Magnifying glass circle */}
                <circle 
                  cx="17" 
                  cy="17" 
                  r="8" 
                  stroke="rgba(255, 0, 0, 1)" 
                  strokeWidth="4" 
                  fill="none"
                />
              </svg>
            </div>
          )}

          {/* Desktop Tooltip Preview */}
          {hoverPreview && !isMobile && (
            <div
              style={{
                position: "fixed",
                left: mousePosition.x + 10,
                top: mousePosition.y + 10,
                background: theme === "dark" ? "hsl(var(--status_background))" : "white",
                padding: "15px",
                borderRadius: "8px",
                boxShadow: theme === "dark" ? "0 2px 4px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.1)",
                maxWidth: "400px",
                zIndex: 1000,
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                color: "var(--text_color)",
                border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                flexShrink: 0,
              }}>
                <img
                  src={hoverPreview.status.account.avatar}
                  alt="Preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <div style={{ 
                flex: 1,
                minWidth: 0,
              }}>
                <div style={{ 
                  fontWeight: "bold", 
                  fontSize: "0.9em",
                  marginBottom: "4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {hoverPreview.status.account.display_name || hoverPreview.status.account.username}
                </div>
                <div style={{ 
                  fontSize: "0.8em", 
                  color: "var(--text_color)",
                  display: "-webkit-box",
                  WebkitLineClamp: "4",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  lineHeight: "1.4",
                  maxHeight: "5.6em",
                }}>
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(hoverPreview.status.content) }} />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Center Preview */}
          {centerPreview && isMobile && (
            <div style={{
              position: "fixed",
              width: "100vw",
              bottom: dimensions.width > dimensions.height ? "15%" : "30%",
              left: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1002,
              pointerEvents: "none",
              transform: "translateX(calc((100vw - 100%) / -2))",
            }}>
              <div
                style={{
                  background: theme === "dark" ? "hsl(var(--status_background))" : "white",
                  padding: "12px",
                  borderRadius: "8px",
                  boxShadow: theme === "dark" ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.15)",
                  width: "90%",
                  maxWidth: "450px",
                  minWidth: "250px",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  border: "2px solid rgba(255, 0, 0, 0.5)",
                  maxHeight: "120px",
                  overflow: "hidden",
                  margin: "0 auto",
                  color: "var(--text_color)",
                }}
              >
                <div style={{
                  width: "48px",
                  height: "48px",
                  flexShrink: 0,
                }}>
                  <img
                    src={centerPreview.status.account.avatar}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                </div>
                <div style={{ 
                  flex: 1,
                  minWidth: 0,
                  width: "calc(100% - 44px)",
                }}>
                  <div style={{ 
                    fontWeight: "bold", 
                    fontSize: "0.9em",
                    marginBottom: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {centerPreview.cluster}
                  </div>
                  <div style={{ 
                    fontSize: "0.8em", 
                    color: "var(--text_color)",
                    display: "-webkit-box",
                    WebkitLineClamp: "3",
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: "1.4",
                    maxHeight: "4.2em",
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(centerPreview.status.content) }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Info Card on Hover */}
          {hoverAccount && !isMobile && (
            <div
              style={{
                position: "fixed",
                left: mousePosition.x + 10,
                top: mousePosition.y + 10,
                background: theme === "dark" ? "hsl(var(--status_background))" : "white",
                padding: "16px",
                borderRadius: "12px",
                boxShadow: theme === "dark" ? "0 4px 12px rgba(0,0,0,0.3)" : "0 4px 12px rgba(0,0,0,0.15)",
                maxWidth: "300px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                color: "var(--text_color)",
              }}
            >
              <div style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  flexShrink: 0,
                }}>
                  <img
                    src={hoverAccount.image}
                    alt="Account"
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: theme === "dark" ? "2px solid rgba(255, 255, 255, 0.1)" : "2px solid #eee",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "4px",
                    marginBottom: "4px",
                  }}>
                    <span style={{ 
                      fontWeight: "bold",
                      fontSize: "1.1em",
                      color: "var(--text_color)",
                    }}>
                      {hoverAccount.name}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: "0.9em",
                    color: "var(--text_color)",
                    opacity: 0.7,
                  }}>
                    @{hoverAccount.accountId}
                  </div>
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "8px",
                fontSize: "0.9em",
                color: "var(--text_color)",
              }}>
                <div>
                  <span style={{ fontWeight: "bold", color: "var(--text_color)" }}>{hoverAccount.followers.toLocaleString()}</span>
                  <br />
                  <span style={{ opacity: 0.7 }}>Followers</span>
                </div>
                <div>
                  <span style={{ fontWeight: "bold", color: "var(--text_color)" }}>{hoverAccount.posts}</span>
                  <br />
                  <span style={{ opacity: 0.7 }}>Posts in Topic</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            {!isMobile && isSidebarVisible && (
              <div
                style={{
                  width: "500px",
                  background: theme === "dark" ? "hsl(var(--status_background))" : "#f8f9fa",
                  borderRight: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #ddd",
                  position: "relative",
                  color: "var(--text_color)",
                  display: "flex",
                  flexDirection: "column",
                  height: "100vh",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={handleCloseSidebar}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    padding: "5px 10px",
                    background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "#ddd",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    zIndex: 10001,
                  }}
                >
                  ×
                </button>
                <h3 style={{ padding: "15px 15px 0 15px" }}>Post Details</h3>
                <div 
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "15px",
                    paddingTop: "5px",
                    height: "calc(100vh - 60px)",
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {statusData ? (
                    <div>
                      {renderStatus(statusData)}
                      <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>Replies</h3>
                      {loadingStatus ? (
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "center", 
                          alignItems: "center", 
                          height: "100px",
                          fontSize: "1rem",
                          color: "var(--text_color)"
                        }}>
                          Loading replies...
                        </div>
                      ) : replies.length > 0 ? (
                        replies.map((reply, index) => (
                          <div key={reply.id}>
                            {renderStatus(
                              reply.reblog ? reply.reblog : reply, 
                              true, 
                              index < replies.length-1 && reply.id === replies[index+1].in_reply_to_id
                            )}
                          </div>
                        ))
                      ) : (
                        <p>No replies yet</p>
                      )}
                    </div>
                  ) : (
                    <p>Click a profile to view the post.</p>
                  )}
                </div>
              </div>
            )}

            <div style={{ flex: 1 }}>
              <svg ref={svgRef} style={{ width: "100%", height: "100%" }}></svg>
            </div>

            {/* Mobile Post Details Modal */}
            {isMobile && isSidebarVisible && selectedProfile && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: theme === "dark" ? "hsl(var(--body_background))" : "white",
                  zIndex: 9999,
                  display: "flex",
                  flexDirection: "column",
                  boxSizing: "border-box",
                  height: "100vh",
                  width: "100vw",
                  color: "var(--text_color)",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "15px",
                  flexShrink: 0,
                  position: "sticky",
                  top: 0,
                  background: theme === "dark" ? "hsl(var(--body_background))" : "white",
                  zIndex: 10000,
                  borderBottom: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #eee",
                }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Post Details</h2>
                  <button
                    onClick={handleCloseSidebar}
                    style={{
                      padding: "8px",
                      background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "#ddd",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "18px",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: 10001,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div 
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "15px",
                    height: "calc(100vh - 60px)",
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {statusData ? (
                    <>
                      <div style={{
                        marginBottom: "12px",
                      }}>
                        {renderStatus(statusData)}
                      </div>
                      <div style={{
                        background: theme === "dark" ? "hsl(var(--status_background))" : "#f8f9fa",
                        padding: "12px",
                        borderRadius: "8px",
                      }}>
                        <h3 style={{ marginTop: "0", marginBottom: "10px" }}>Replies</h3>
                        {loadingStatus ? (
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "center", 
                            alignItems: "center", 
                            height: "100px",
                            fontSize: "1rem",
                            color: "var(--text_color)"
                          }}>
                            Loading replies...
                          </div>
                        ) : replies.length > 0 ? (
                          replies.map((reply, index) => (
                            <div key={reply.id}>
                              {renderStatus(
                                reply.reblog ? reply.reblog : reply, 
                                true, 
                                index < replies.length-1 && reply.id === replies[index+1].in_reply_to_id
                              )}
                            </div>
                          ))
                        ) : (
                          <p>No replies yet</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>Loading post details...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphHome;
