import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import './BubbleCluster.css';

const BubbleCluster = ({ data }) => {
  console.log("BubbleCluster received data:", data);
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [preview, setPreview] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      console.log("Window resized:", { width, height });
      setDimensions({ width, height });
      setIsMobile(width <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize layout and simulation
  useEffect(() => {
    console.log("BubbleCluster useEffect triggered with data:", data);
    console.log("Current dimensions:", dimensions);
    console.log("SVG ref:", svgRef.current);
    
    if (!data || !svgRef.current || !Array.isArray(data)) {
      console.warn('Invalid data or svgRef:', { data, svgRef: !!svgRef.current });
      return;
    }

    if (dimensions.width === 0 || dimensions.height === 0) {
      console.warn('Invalid dimensions:', dimensions);
      return;
    }

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    console.log("Setting up D3 visualization with dimensions:", { width, height });

    // Clear previous visualization
    svg.selectAll("*").remove();

    // Create scales
    const xScale = d3.scaleLinear().domain([0, width]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, height]).range([0, height]);
    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.count || 0)])
      .range([30, 80]);

    console.log("Created scales:", { 
      xScale: xScale.domain(), 
      yScale: yScale.domain(), 
      radiusScale: radiusScale.domain() 
    });

    // Create force simulation for clusters
    const simulation = d3.forceSimulation(data)
      .force("x", d3.forceX(width / 2).strength(0.2))
      .force("y", d3.forceY(height / 2).strength(0.2))
      .force("collide", d3.forceCollide().radius(d => radiusScale(d.count || 0) * 1.2))
      .force("charge", d3.forceManyBody().strength(-100))
      .velocityDecay(0.3);

    // Initialize cluster positions
    data.forEach(d => {
      d.x = width / 2 + (Math.random() - 0.5) * 100;
      d.y = height / 2 + (Math.random() - 0.5) * 100;
    });

    console.log("Created force simulation");

    // Create parent groups if they don't exist
    if (!svg.select(".clusters").size()) {
      svg.append("g").attr("class", "clusters");
    }
    if (!svg.select(".profiles").size()) {
      svg.append("g").attr("class", "profiles");
    }

    // Create cluster groups
    const clusters = svg.select(".clusters")
      .selectAll(".cluster")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "cluster")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    console.log("Created cluster groups:", clusters.size());

    // Add cluster boundaries with fill
    clusters.append("circle")
      .attr("class", "cluster-boundary")
      .attr("r", d => radiusScale(d.count || 0))
      .style("fill", d => d3.color(d.color || "#f0f0f0").brighter(0.5))
      .style("fill-opacity", 0.2)
      .style("stroke", d => d.color || "#ccc")
      .style("stroke-width", 2);

    // Add cluster labels with better visibility
    clusters.append("text")
      .attr("class", "cluster-label")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .text(d => d.name || "Unnamed Cluster")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#333");

    // Create profile groups with improved simulation
    const flattenedData = data.flatMap(d => (d.elements || []).map(e => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * radiusScale(d.count || 0) * 0.8;
      return {
        ...e,
        cluster: d,
        x: d.x + radius * Math.cos(angle),
        y: d.y + radius * Math.sin(angle)
      };
    }));

    const profileSimulation = d3.forceSimulation(flattenedData)
      .force("cluster", d => {
        const alpha = 0.3;
        const k = alpha * 1;
        const dx = d.cluster.x - d.x;
        const dy = d.cluster.y - d.y;
        const l = Math.sqrt(dx * dx + dy * dy);
        if (l !== 0) {
          d.vx += (dx / l) * k;
          d.vy += (dy / l) * k;
        }
      })
      .force("collide", d3.forceCollide().radius(12))
      .force("charge", d3.forceManyBody().strength(-30))
      .velocityDecay(0.3);

    const profiles = svg.select(".profiles")
      .selectAll(".profile-group")
      .data(flattenedData)
      .enter()
      .append("g")
      .attr("class", "profile-group")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    console.log("Created profile groups:", profiles.size());

    // Add profile circles with improved styling
    profiles.append("circle")
      .attr("r", 10)
      .style("fill", d => d.color || d.cluster.color || "#1DA1F2")
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .style("opacity", 0.9)
      .on("mouseover", (event, d) => {
        d3.select(event.target)
          .transition()
          .duration(200)
          .attr("r", 15)
          .style("opacity", 1);
        setPreview({
          profile: d,
          x: event.pageX,
          y: event.pageY
        });
      })
      .on("mouseout", (event, d) => {
        d3.select(event.target)
          .transition()
          .duration(200)
          .attr("r", 10)
          .style("opacity", 0.9);
        setPreview(null);
      })
      .on("click", (event, d) => {
        setSelectedProfile(d);
        setShowSidebar(true);
      });

    // Update positions on each tick with smoother transitions
    simulation.on("tick", () => {
      clusters
        .transition()
        .duration(50)
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    profileSimulation.on("tick", () => {
      profiles
        .transition()
        .duration(50)
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) profileSimulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) profileSimulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
      profileSimulation.stop();
    };
  }, [data, dimensions]);

  return (
    <div className="bubble-cluster-container">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}>
        <g className="clusters" />
        <g className="profiles" />
      </svg>
      
      {preview && (
        <div className="preview-card" style={{ left: preview.x, top: preview.y }}>
          <img src={preview.profile.image} alt={preview.profile.account_name} />
          <div>
            <div className="name">{preview.profile.account_name}</div>
            <div className="username">@{preview.profile.username}</div>
          </div>
        </div>
      )}
      
      {selectedProfile && (
        <div className={`sidebar ${showSidebar ? 'show' : ''}`}>
          <button onClick={() => setShowSidebar(false)}>×</button>
          <div className="profile-header">
            <img src={selectedProfile.image} alt={selectedProfile.account_name} />
            <div className="profile-info">
              <h2>{selectedProfile.account_name}</h2>
              <div className="username">@{selectedProfile.username}</div>
              <div className="bio">{selectedProfile.account_description}</div>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <strong>{selectedProfile.followers_count}</strong> Followers
            </div>
            <div className="stat">
              <strong>{selectedProfile.following_count}</strong> Following
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BubbleCluster; 