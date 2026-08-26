-- =====================================================================
-- BookWorm — Rich Content Update
-- Adds real markdown content to existing notes
-- Run AFTER seed_data.sql to replace minimal content with rich content
-- =====================================================================

-- Delete existing content for Note 1 (must delete in reverse FK order)
DELETE FROM editions WHERE note_id = '750e8400-e29b-41d4-a716-446655440001';
DELETE FROM commit_manifests WHERE commit_id = 'b50e8400-e29b-41d4-a716-446655440001';
DELETE FROM commits WHERE commit_id = 'b50e8400-e29b-41d4-a716-446655440001';
DELETE FROM block_version_contents WHERE version_id = 'a50e8400-e29b-41d4-a716-446655440001';
DELETE FROM logical_block_slots WHERE slot_id = '950e8400-e29b-41d4-a716-446655440001';
DELETE FROM content_blobs WHERE sha256 = encode(digest('# B-Trees and AVL Self-Balancing Trees', 'sha256'), 'hex');

-- Note 1: Rich content about B-Trees
INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('# B-Trees and AVL Self-Balancing Trees

## Introduction to Self-Balancing Trees

Self-balancing binary search trees are fundamental data structures in computer science. They maintain their height automatically during insertions and deletions, ensuring **O(log n)** time complexity for all basic operations.

## B-Trees

### What is a B-Tree?

A **B-Tree** is a self-balancing tree data structure that maintains sorted data and allows searches, sequential access, insertions, and deletions in **logarithmic time**. B-Trees are optimized for systems that read and write large blocks of data.

### Key Properties:

- Every node has at most `m` children (where `m` is the order)
- Every non-leaf node (except root) has at least `⌈m/2⌉` children
- The root has at least 2 children if it is not a leaf node
- All leaves appear at the same level
- A non-leaf node with `k` children contains `k-1` keys

### Time Complexity:

| Operation | Average | Worst Case |
|-----------|---------|------------|
| Search    | O(log n) | O(log n) |
| Insert    | O(log n) | O(log n) |
| Delete    | O(log n) | O(log n) |

### Example Use Cases:

1. **Database systems** - B-Trees are used in database indexing
2. **File systems** - NTFS, ext4, and HFS+ use B-Tree variants
3. **Key-value stores** - Many NoSQL databases implement B-Trees

## AVL Trees

### What is an AVL Tree?

Named after inventors **Adelson-Velsky and Landis**, an AVL tree is a self-balancing binary search tree where the heights of two child subtrees of any node differ by at most **1**.

### Balance Factor:

```
Balance Factor = Height(Left Subtree) - Height(Right Subtree)
```

For an AVL tree, balance factor must be **-1, 0, or +1**.

### Rotations:

AVL trees maintain balance through four types of rotations:

1. **Left Rotation** - Used when right subtree is taller
2. **Right Rotation** - Used when left subtree is taller  
3. **Left-Right Rotation** - Double rotation for complex imbalance
4. **Right-Left Rotation** - Double rotation for complex imbalance

### Comparison: B-Trees vs AVL Trees

**When to use B-Trees:**
- Dealing with large datasets that don''t fit in memory
- Database systems and file systems
- Need to minimize disk I/O operations

**When to use AVL Trees:**
- Need faster lookups than other balanced trees
- Dataset fits in memory
- Lookup-heavy workload (reads >> writes)

## Practical Implementation

Here''s a simple visualization of an AVL tree:

```
        10
       /  \
      5    15
     / \   / \
    3   7 12  20
```

Balance factors: All nodes have balance factor 0 (perfectly balanced)

## Summary

Both B-Trees and AVL Trees solve the problem of maintaining balanced trees, but for different use cases:

- **B-Trees** excel at minimizing disk I/O
- **AVL Trees** provide faster in-memory lookups
- Both guarantee **O(log n)** operations

Understanding when to use each structure is key to building efficient systems.

---

*Last updated by @alice*', 'sha256'), 'hex'), 
'# B-Trees and AVL Self-Balancing Trees

## Introduction to Self-Balancing Trees

Self-balancing binary search trees are fundamental data structures in computer science. They maintain their height automatically during insertions and deletions, ensuring **O(log n)** time complexity for all basic operations.

## B-Trees

### What is a B-Tree?

A **B-Tree** is a self-balancing tree data structure that maintains sorted data and allows searches, sequential access, insertions, and deletions in **logarithmic time**. B-Trees are optimized for systems that read and write large blocks of data.

### Key Properties:

- Every node has at most `m` children (where `m` is the order)
- Every non-leaf node (except root) has at least `⌈m/2⌉` children
- The root has at least 2 children if it is not a leaf node
- All leaves appear at the same level
- A non-leaf node with `k` children contains `k-1` keys

### Time Complexity:

| Operation | Average | Worst Case |
|-----------|---------|------------|
| Search    | O(log n) | O(log n) |
| Insert    | O(log n) | O(log n) |
| Delete    | O(log n) | O(log n) |

### Example Use Cases:

1. **Database systems** - B-Trees are used in database indexing
2. **File systems** - NTFS, ext4, and HFS+ use B-Tree variants
3. **Key-value stores** - Many NoSQL databases implement B-Trees

## AVL Trees

### What is an AVL Tree?

Named after inventors **Adelson-Velsky and Landis**, an AVL tree is a self-balancing binary search tree where the heights of two child subtrees of any node differ by at most **1**.

### Balance Factor:

```
Balance Factor = Height(Left Subtree) - Height(Right Subtree)
```

For an AVL tree, balance factor must be **-1, 0, or +1**.

### Rotations:

AVL trees maintain balance through four types of rotations:

1. **Left Rotation** - Used when right subtree is taller
2. **Right Rotation** - Used when left subtree is taller  
3. **Left-Right Rotation** - Double rotation for complex imbalance
4. **Right-Left Rotation** - Double rotation for complex imbalance

### Comparison: B-Trees vs AVL Trees

**When to use B-Trees:**
- Dealing with large datasets that don''t fit in memory
- Database systems and file systems
- Need to minimize disk I/O operations

**When to use AVL Trees:**
- Need faster lookups than other balanced trees
- Dataset fits in memory
- Lookup-heavy workload (reads >> writes)

## Practical Implementation

Here''s a simple visualization of an AVL tree:

```
        10
       /  \
      5    15
     / \   / \
    3   7 12  20
```

Balance factors: All nodes have balance factor 0 (perfectly balanced)

## Summary

Both B-Trees and AVL Trees solve the problem of maintaining balanced trees, but for different use cases:

- **B-Trees** excel at minimizing disk I/O
- **AVL Trees** provide faster in-memory lookups
- Both guarantee **O(log n)** operations

Understanding when to use each structure is key to building efficient systems.

---

*Last updated by @alice*', 
  length('# B-Trees and AVL Self-Balancing Trees

## Introduction to Self-Balancing Trees

Self-balancing binary search trees are fundamental data structures in computer science. They maintain their height automatically during insertions and deletions, ensuring **O(log n)** time complexity for all basic operations.

## B-Trees

### What is a B-Tree?

A **B-Tree** is a self-balancing tree data structure that maintains sorted data and allows searches, sequential access, insertions, and deletions in **logarithmic time**. B-Trees are optimized for systems that read and write large blocks of data.

### Key Properties:

- Every node has at most `m` children (where `m` is the order)
- Every non-leaf node (except root) has at least `⌈m/2⌉` children
- The root has at least 2 children if it is not a leaf node
- All leaves appear at the same level
- A non-leaf node with `k` children contains `k-1` keys

### Time Complexity:

| Operation | Average | Worst Case |
|-----------|---------|------------|
| Search    | O(log n) | O(log n) |
| Insert    | O(log n) | O(log n) |
| Delete    | O(log n) | O(log n) |

### Example Use Cases:

1. **Database systems** - B-Trees are used in database indexing
2. **File systems** - NTFS, ext4, and HFS+ use B-Tree variants
3. **Key-value stores** - Many NoSQL databases implement B-Trees

## AVL Trees

### What is an AVL Tree?

Named after inventors **Adelson-Velsky and Landis**, an AVL tree is a self-balancing binary search tree where the heights of two child subtrees of any node differ by at most **1**.

### Balance Factor:

```
Balance Factor = Height(Left Subtree) - Height(Right Subtree)
```

For an AVL tree, balance factor must be **-1, 0, or +1**.

### Rotations:

AVL trees maintain balance through four types of rotations:

1. **Left Rotation** - Used when right subtree is taller
2. **Right Rotation** - Used when left subtree is taller  
3. **Left-Right Rotation** - Double rotation for complex imbalance
4. **Right-Left Rotation** - Double rotation for complex imbalance

### Comparison: B-Trees vs AVL Trees

**When to use B-Trees:**
- Dealing with large datasets that don''t fit in memory
- Database systems and file systems
- Need to minimize disk I/O operations

**When to use AVL Trees:**
- Need faster lookups than other balanced trees
- Dataset fits in memory
- Lookup-heavy workload (reads >> writes)

## Practical Implementation

Here''s a simple visualization of an AVL tree:

```
        10
       /  \
      5    15
     / \   / \
    3   7 12  20
```

Balance factors: All nodes have balance factor 0 (perfectly balanced)

## Summary

Both B-Trees and AVL Trees solve the problem of maintaining balanced trees, but for different use cases:

- **B-Trees** excel at minimizing disk I/O
- **AVL Trees** provide faster in-memory lookups
- Both guarantee **O(log n)** operations

Understanding when to use each structure is key to building efficient systems.

---

*Last updated by @alice*'));

-- Recreate logical block slot
INSERT INTO logical_block_slots (slot_id, note_id, parent_slot_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', NULL, '1|100000', 'PARAGRAPH');

-- Create block version
INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 
   encode(digest('# B-Trees and AVL Self-Balancing Trees

## Introduction to Self-Balancing Trees

Self-balancing binary search trees are fundamental data structures in computer science. They maintain their height automatically during insertions and deletions, ensuring **O(log n)** time complexity for all basic operations.

## B-Trees

### What is a B-Tree?

A **B-Tree** is a self-balancing tree data structure that maintains sorted data and allows searches, sequential access, insertions, and deletions in **logarithmic time**. B-Trees are optimized for systems that read and write large blocks of data.

### Key Properties:

- Every node has at most `m` children (where `m` is the order)
- Every non-leaf node (except root) has at least `⌈m/2⌉` children
- The root has at least 2 children if it is not a leaf node
- All leaves appear at the same level
- A non-leaf node with `k` children contains `k-1` keys

### Time Complexity:

| Operation | Average | Worst Case |
|-----------|---------|------------|
| Search    | O(log n) | O(log n) |
| Insert    | O(log n) | O(log n) |
| Delete    | O(log n) | O(log n) |

### Example Use Cases:

1. **Database systems** - B-Trees are used in database indexing
2. **File systems** - NTFS, ext4, and HFS+ use B-Tree variants
3. **Key-value stores** - Many NoSQL databases implement B-Trees

## AVL Trees

### What is an AVL Tree?

Named after inventors **Adelson-Velsky and Landis**, an AVL tree is a self-balancing binary search tree where the heights of two child subtrees of any node differ by at most **1**.

### Balance Factor:

```
Balance Factor = Height(Left Subtree) - Height(Right Subtree)
```

For an AVL tree, balance factor must be **-1, 0, or +1**.

### Rotations:

AVL trees maintain balance through four types of rotations:

1. **Left Rotation** - Used when right subtree is taller
2. **Right Rotation** - Used when left subtree is taller  
3. **Left-Right Rotation** - Double rotation for complex imbalance
4. **Right-Left Rotation** - Double rotation for complex imbalance

### Comparison: B-Trees vs AVL Trees

**When to use B-Trees:**
- Dealing with large datasets that don''t fit in memory
- Database systems and file systems
- Need to minimize disk I/O operations

**When to use AVL Trees:**
- Need faster lookups than other balanced trees
- Dataset fits in memory
- Lookup-heavy workload (reads >> writes)

## Practical Implementation

Here''s a simple visualization of an AVL tree:

```
        10
       /  \
      5    15
     / \   / \
    3   7 12  20
```

Balance factors: All nodes have balance factor 0 (perfectly balanced)

## Summary

Both B-Trees and AVL Trees solve the problem of maintaining balanced trees, but for different use cases:

- **B-Trees** excel at minimizing disk I/O
- **AVL Trees** provide faster in-memory lookups
- Both guarantee **O(log n)** operations

Understanding when to use each structure is key to building efficient systems.

---

*Last updated by @alice*', 'sha256'), 'hex'));

-- Recreate commit
INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial commit', 'abc123initial1', '2026-02-10 10:00:00');

-- Recreate manifest
INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001');

-- Note 2: Delete and recreate with rich content about Dijkstra
DELETE FROM editions WHERE note_id = '750e8400-e29b-41d4-a716-446655440002';
DELETE FROM commit_manifests WHERE commit_id = 'b50e8400-e29b-41d4-a716-446655440002';
DELETE FROM commits WHERE commit_id = 'b50e8400-e29b-41d4-a716-446655440002';
DELETE FROM block_version_contents WHERE version_id = 'a50e8400-e29b-41d4-a716-446655440002';
DELETE FROM logical_block_slots WHERE slot_id = '950e8400-e29b-41d4-a716-446655440002';
DELETE FROM content_blobs WHERE sha256 = encode(digest('# Graph Algorithms & Dijkstra Shortest Path', 'sha256'), 'hex');

INSERT INTO content_blobs (sha256, content_text, byte_size) VALUES
  (encode(digest('# Graph Algorithms & Dijkstra''s Shortest Path

## Introduction to Graph Algorithms

Graphs are one of the most versatile data structures in computer science, representing relationships between entities. Graph algorithms form the backbone of many real-world applications from GPS navigation to social networks.

## What is Dijkstra''s Algorithm?

**Dijkstra''s algorithm** finds the shortest path between nodes in a weighted graph. Developed by **Edsger W. Dijkstra** in 1956, it remains one of the most important algorithms in computer science.

### Key Characteristics:

- Works on **weighted directed or undirected graphs**
- Requires **non-negative edge weights**  
- Uses a **greedy approach**
- Guarantees the shortest path
- Time complexity: **O((V + E) log V)** with min-heap

## How It Works

The algorithm maintains two sets:

1. **Visited nodes** - nodes with known shortest distance
2. **Unvisited nodes** - nodes still being processed

### Step-by-Step Process:

1. Set distance to start node as 0, all others as ∞
2. Mark all nodes as unvisited
3. Select unvisited node with smallest distance
4. Update distances to neighbors
5. Mark current node as visited
6. Repeat until all nodes visited

## Visual Example

Consider this weighted graph:

```
     7
  A-----B
  |     |\ 2
 5|     | C
  |  1  |/
  D-----E
     3
```

Finding shortest path from **A to C**:

- A → D → E → C = 5 + 1 + 2 = **8**
- A → B → C = 7 + 2 = **9**

Dijkstra finds the optimal path: **A → D → E → C** (distance 8)

## Implementation Pseudocode

```python
function dijkstra(graph, start):
    distances = {node: infinity for node in graph}
    distances[start] = 0
    pq = PriorityQueue()
    pq.add((0, start))
    
    while pq not empty:
        current_dist, current = pq.pop()
        
        if current_dist > distances[current]:
            continue
            
        for neighbor, weight in graph[current]:
            distance = current_dist + weight
            
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                pq.add((distance, neighbor))
    
    return distances
```

## Real-World Applications

### 1. GPS Navigation
Finding shortest routes between locations accounting for:
- Distance
- Traffic conditions
- Road speed limits

### 2. Network Routing
- Internet packet routing (OSPF protocol)
- Telecommunication networks
- Data center network optimization

### 3. Social Networks
- Friend suggestions (shortest social distance)
- Influence propagation analysis
- Community detection

### 4. Game Development
- NPC pathfinding
- AI opponent behavior
- Resource optimization

## Comparison with Other Algorithms

| Algorithm | Use Case | Negative Weights | Time Complexity |
|-----------|----------|------------------|-----------------|
| **Dijkstra** | Single-source shortest path | ❌ No | O((V+E) log V) |
| **Bellman-Ford** | Negative weights | ✅ Yes | O(VE) |
| **A\*** | Heuristic-guided search | ❌ No | O(E) best case |
| **Floyd-Warshall** | All-pairs shortest path | ✅ Yes | O(V³) |

## Limitations

While powerful, Dijkstra''s algorithm has constraints:

- **Cannot handle negative weights** - use Bellman-Ford instead
- **Single source only** - for all pairs, use Floyd-Warshall
- **Memory intensive** - stores all distances in memory
- **Not optimal for unweighted graphs** - BFS is faster

## Optimizations

### Priority Queue Implementation
Using a **binary heap** or **Fibonacci heap** significantly improves performance:

- Binary heap: **O((V + E) log V)**
- Fibonacci heap: **O(E + V log V)** (theoretical best)

### Bidirectional Search
Search from both source and destination simultaneously:
- Reduces search space
- Up to **2x faster** in practice

## Summary

Dijkstra''s algorithm is a cornerstone of graph theory and practical computing:

✅ **Strengths:**
- Guaranteed optimal solution
- Efficient with proper data structures
- Wide range of applications

❌ **Weaknesses:**  
- No negative weights
- Single-source only
- Memory requirements

Understanding Dijkstra''s algorithm is essential for any computer scientist working with graphs, networks, or optimization problems.

---

*Last updated by @alice*', 'sha256'), 'hex'),
'# Graph Algorithms & Dijkstra''s Shortest Path

## Introduction to Graph Algorithms

Graphs are one of the most versatile data structures in computer science, representing relationships between entities. Graph algorithms form the backbone of many real-world applications from GPS navigation to social networks.

## What is Dijkstra''s Algorithm?

**Dijkstra''s algorithm** finds the shortest path between nodes in a weighted graph. Developed by **Edsger W. Dijkstra** in 1956, it remains one of the most important algorithms in computer science.

### Key Characteristics:

- Works on **weighted directed or undirected graphs**
- Requires **non-negative edge weights**  
- Uses a **greedy approach**
- Guarantees the shortest path
- Time complexity: **O((V + E) log V)** with min-heap

## How It Works

The algorithm maintains two sets:

1. **Visited nodes** - nodes with known shortest distance
2. **Unvisited nodes** - nodes still being processed

### Step-by-Step Process:

1. Set distance to start node as 0, all others as ∞
2. Mark all nodes as unvisited
3. Select unvisited node with smallest distance
4. Update distances to neighbors
5. Mark current node as visited
6. Repeat until all nodes visited

## Visual Example

Consider this weighted graph:

```
     7
  A-----B
  |     |\ 2
 5|     | C
  |  1  |/
  D-----E
     3
```

Finding shortest path from **A to C**:

- A → D → E → C = 5 + 1 + 2 = **8**
- A → B → C = 7 + 2 = **9**

Dijkstra finds the optimal path: **A → D → E → C** (distance 8)

## Implementation Pseudocode

```python
function dijkstra(graph, start):
    distances = {node: infinity for node in graph}
    distances[start] = 0
    pq = PriorityQueue()
    pq.add((0, start))
    
    while pq not empty:
        current_dist, current = pq.pop()
        
        if current_dist > distances[current]:
            continue
            
        for neighbor, weight in graph[current]:
            distance = current_dist + weight
            
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                pq.add((distance, neighbor))
    
    return distances
```

## Real-World Applications

### 1. GPS Navigation
Finding shortest routes between locations accounting for:
- Distance
- Traffic conditions
- Road speed limits

### 2. Network Routing
- Internet packet routing (OSPF protocol)
- Telecommunication networks
- Data center network optimization

### 3. Social Networks
- Friend suggestions (shortest social distance)
- Influence propagation analysis
- Community detection

### 4. Game Development
- NPC pathfinding
- AI opponent behavior
- Resource optimization

## Comparison with Other Algorithms

| Algorithm | Use Case | Negative Weights | Time Complexity |
|-----------|----------|------------------|-----------------|
| **Dijkstra** | Single-source shortest path | ❌ No | O((V+E) log V) |
| **Bellman-Ford** | Negative weights | ✅ Yes | O(VE) |
| **A\*** | Heuristic-guided search | ❌ No | O(E) best case |
| **Floyd-Warshall** | All-pairs shortest path | ✅ Yes | O(V³) |

## Limitations

While powerful, Dijkstra''s algorithm has constraints:

- **Cannot handle negative weights** - use Bellman-Ford instead
- **Single source only** - for all pairs, use Floyd-Warshall
- **Memory intensive** - stores all distances in memory
- **Not optimal for unweighted graphs** - BFS is faster

## Optimizations

### Priority Queue Implementation
Using a **binary heap** or **Fibonacci heap** significantly improves performance:

- Binary heap: **O((V + E) log V)**
- Fibonacci heap: **O(E + V log V)** (theoretical best)

### Bidirectional Search
Search from both source and destination simultaneously:
- Reduces search space
- Up to **2x faster** in practice

## Summary

Dijkstra''s algorithm is a cornerstone of graph theory and practical computing:

✅ **Strengths:**
- Guaranteed optimal solution
- Efficient with proper data structures
- Wide range of applications

❌ **Weaknesses:**  
- No negative weights
- Single-source only
- Memory requirements

Understanding Dijkstra''s algorithm is essential for any computer scientist working with graphs, networks, or optimization problems.

---

*Last updated by @alice*',
length('# Graph Algorithms & Dijkstra''s Shortest Path

## Introduction to Graph Algorithms

Graphs are one of the most versatile data structures in computer science, representing relationships between entities. Graph algorithms form the backbone of many real-world applications from GPS navigation to social networks.

## What is Dijkstra''s Algorithm?

**Dijkstra''s algorithm** finds the shortest path between nodes in a weighted graph. Developed by **Edsger W. Dijkstra** in 1956, it remains one of the most important algorithms in computer science.

### Key Characteristics:

- Works on **weighted directed or undirected graphs**
- Requires **non-negative edge weights**  
- Uses a **greedy approach**
- Guarantees the shortest path
- Time complexity: **O((V + E) log V)** with min-heap

## How It Works

The algorithm maintains two sets:

1. **Visited nodes** - nodes with known shortest distance
2. **Unvisited nodes** - nodes still being processed

### Step-by-Step Process:

1. Set distance to start node as 0, all others as ∞
2. Mark all nodes as unvisited
3. Select unvisited node with smallest distance
4. Update distances to neighbors
5. Mark current node as visited
6. Repeat until all nodes visited

## Visual Example

Consider this weighted graph:

```
     7
  A-----B
  |     |\ 2
 5|     | C
  |  1  |/
  D-----E
     3
```

Finding shortest path from **A to C**:

- A → D → E → C = 5 + 1 + 2 = **8**
- A → B → C = 7 + 2 = **9**

Dijkstra finds the optimal path: **A → D → E → C** (distance 8)

## Implementation Pseudocode

```python
function dijkstra(graph, start):
    distances = {node: infinity for node in graph}
    distances[start] = 0
    pq = PriorityQueue()
    pq.add((0, start))
    
    while pq not empty:
        current_dist, current = pq.pop()
        
        if current_dist > distances[current]:
            continue
            
        for neighbor, weight in graph[current]:
            distance = current_dist + weight
            
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                pq.add((distance, neighbor))
    
    return distances
```

## Real-World Applications

### 1. GPS Navigation
Finding shortest routes between locations accounting for:
- Distance
- Traffic conditions
- Road speed limits

### 2. Network Routing
- Internet packet routing (OSPF protocol)
- Telecommunication networks
- Data center network optimization

### 3. Social Networks
- Friend suggestions (shortest social distance)
- Influence propagation analysis
- Community detection

### 4. Game Development
- NPC pathfinding
- AI opponent behavior
- Resource optimization

## Comparison with Other Algorithms

| Algorithm | Use Case | Negative Weights | Time Complexity |
|-----------|----------|------------------|-----------------|
| **Dijkstra** | Single-source shortest path | ❌ No | O((V+E) log V) |
| **Bellman-Ford** | Negative weights | ✅ Yes | O(VE) |
| **A\*** | Heuristic-guided search | ❌ No | O(E) best case |
| **Floyd-Warshall** | All-pairs shortest path | ✅ Yes | O(V³) |

## Limitations

While powerful, Dijkstra''s algorithm has constraints:

- **Cannot handle negative weights** - use Bellman-Ford instead
- **Single source only** - for all pairs, use Floyd-Warshall
- **Memory intensive** - stores all distances in memory
- **Not optimal for unweighted graphs** - BFS is faster

## Optimizations

### Priority Queue Implementation
Using a **binary heap** or **Fibonacci heap** significantly improves performance:

- Binary heap: **O((V + E) log V)**
- Fibonacci heap: **O(E + V log V)** (theoretical best)

### Bidirectional Search
Search from both source and destination simultaneously:
- Reduces search space
- Up to **2x faster** in practice

## Summary

Dijkstra''s algorithm is a cornerstone of graph theory and practical computing:

✅ **Strengths:**
- Guaranteed optimal solution
- Efficient with proper data structures
- Wide range of applications

❌ **Weaknesses:**  
- No negative weights
- Single-source only
- Memory requirements

Understanding Dijkstra''s algorithm is essential for any computer scientist working with graphs, networks, or optimization problems.

---

*Last updated by @alice*'));

INSERT INTO logical_block_slots (slot_id, note_id, parent_slot_id, lexorank_key, block_type) VALUES
  ('950e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', NULL, '1|100000', 'PARAGRAPH');

INSERT INTO block_version_contents (version_id, slot_id, author_id, content_blob_hash) VALUES
  ('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001',
   encode(digest('# Graph Algorithms & Dijkstra''s Shortest Path

## Introduction to Graph Algorithms

Graphs are one of the most versatile data structures in computer science, representing relationships between entities. Graph algorithms form the backbone of many real-world applications from GPS navigation to social networks.

## What is Dijkstra''s Algorithm?

**Dijkstra''s algorithm** finds the shortest path between nodes in a weighted graph. Developed by **Edsger W. Dijkstra** in 1956, it remains one of the most important algorithms in computer science.

### Key Characteristics:

- Works on **weighted directed or undirected graphs**
- Requires **non-negative edge weights**  
- Uses a **greedy approach**
- Guarantees the shortest path
- Time complexity: **O((V + E) log V)** with min-heap

## How It Works

The algorithm maintains two sets:

1. **Visited nodes** - nodes with known shortest distance
2. **Unvisited nodes** - nodes still being processed

### Step-by-Step Process:

1. Set distance to start node as 0, all others as ∞
2. Mark all nodes as unvisited
3. Select unvisited node with smallest distance
4. Update distances to neighbors
5. Mark current node as visited
6. Repeat until all nodes visited

## Visual Example

Consider this weighted graph:

```
     7
  A-----B
  |     |\ 2
 5|     | C
  |  1  |/
  D-----E
     3
```

Finding shortest path from **A to C**:

- A → D → E → C = 5 + 1 + 2 = **8**
- A → B → C = 7 + 2 = **9**

Dijkstra finds the optimal path: **A → D → E → C** (distance 8)

## Implementation Pseudocode

```python
function dijkstra(graph, start):
    distances = {node: infinity for node in graph}
    distances[start] = 0
    pq = PriorityQueue()
    pq.add((0, start))
    
    while pq not empty:
        current_dist, current = pq.pop()
        
        if current_dist > distances[current]:
            continue
            
        for neighbor, weight in graph[current]:
            distance = current_dist + weight
            
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                pq.add((distance, neighbor))
    
    return distances
```

## Real-World Applications

### 1. GPS Navigation
Finding shortest routes between locations accounting for:
- Distance
- Traffic conditions
- Road speed limits

### 2. Network Routing
- Internet packet routing (OSPF protocol)
- Telecommunication networks
- Data center network optimization

### 3. Social Networks
- Friend suggestions (shortest social distance)
- Influence propagation analysis
- Community detection

### 4. Game Development
- NPC pathfinding
- AI opponent behavior
- Resource optimization

## Comparison with Other Algorithms

| Algorithm | Use Case | Negative Weights | Time Complexity |
|-----------|----------|------------------|-----------------|
| **Dijkstra** | Single-source shortest path | ❌ No | O((V+E) log V) |
| **Bellman-Ford** | Negative weights | ✅ Yes | O(VE) |
| **A\*** | Heuristic-guided search | ❌ No | O(E) best case |
| **Floyd-Warshall** | All-pairs shortest path | ✅ Yes | O(V³) |

## Limitations

While powerful, Dijkstra''s algorithm has constraints:

- **Cannot handle negative weights** - use Bellman-Ford instead
- **Single source only** - for all pairs, use Floyd-Warshall
- **Memory intensive** - stores all distances in memory
- **Not optimal for unweighted graphs** - BFS is faster

## Optimizations

### Priority Queue Implementation
Using a **binary heap** or **Fibonacci heap** significantly improves performance:

- Binary heap: **O((V + E) log V)**
- Fibonacci heap: **O(E + V log V)** (theoretical best)

### Bidirectional Search
Search from both source and destination simultaneously:
- Reduces search space
- Up to **2x faster** in practice

## Summary

Dijkstra''s algorithm is a cornerstone of graph theory and practical computing:

✅ **Strengths:**
- Guaranteed optimal solution
- Efficient with proper data structures
- Wide range of applications

❌ **Weaknesses:**  
- No negative weights
- Single-source only
- Memory requirements

Understanding Dijkstra''s algorithm is essential for any computer scientist working with graphs, networks, or optimization problems.

---

*Last updated by @alice*', 'sha256'), 'hex'));

INSERT INTO commits (commit_id, branch_id, parent_commit_id, author_id, commit_message, commit_hash, created_at) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440002', NULL, '550e8400-e29b-41d4-a716-446655440001', 'Initial commit', 'abc123initial2', '2026-02-10 10:30:00');

INSERT INTO commit_manifests (commit_id, slot_id, version_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440002');
