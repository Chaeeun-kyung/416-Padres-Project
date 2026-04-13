import random 
import networkx as nx
 
def create_test_graph(rows=4, cols=4, num_districts=4, pop=100):
    """
    Create a simple grid graph with fake population and district labels.
    """

    G = nx.grid_graph(dim=[rows, cols])

    nodes = list(G.nodes())
    nodes.sort()

    # assign population
    for node in nodes:
        G.nodes[node]["population"] = pop

    # assign simple district labels by row blocks for 4x4 
    # with 4 districts: row 0 -> district 0 row 1 -> 
    # district 1 row 2 -> district 2 row 3 -> district 3
    for node in nodes:
        r, c = node
        district = min(r, num_districts - 1)
        G.nodes[node]["district"] = district
    return G 

def district_populations(G):
    """
    Return total population in each district.
    """

    pops = {}
    for node in G.nodes():
        d = G.nodes[node]["district"]
        pops[d] = pops.get(d, 0) + G.nodes[node]["population"]
    return pops 

def find_adjacent_district_pairs(G):
    """
    Return sorted list of touching district pairs.
    """
    pairs = set()
    for u, v in G.edges():
        du = G.nodes[u]["district"]
        dv = G.nodes[v]["district"]
        if du != dv:
            pairs.add(tuple(sorted((du, dv))))
    return sorted(pairs) 

def get_nodes_in_districts(G, d1, d2):
    """
    Return all nodes belonging to district d1 or d2.
    """
    return [n for n in G.nodes() if G.nodes[n]["district"] in (d1, d2)] 

def merged_subgraph(G, d1, d2):
    """
    Return subgraph induced by the two chosen districts.
    """
    nodes = get_nodes_in_districts(G, d1, d2)
    return G.subgraph(nodes).copy() 

def population_of_nodes(G, nodes):
    """
    Sum population of a set/list of nodes.
    """
    return sum(G.nodes[n]["population"] for n in nodes) 

def find_balanced_tree_cut(subgraph, total_pop, tolerance):
    """
    Build a spanning tree and try removing each edge to get two connected, population-balanced pieces.
    Returns:
        (component1, component2) if found
        None otherwise
    """
    tree = nx.minimum_spanning_tree(subgraph)
    target = total_pop / 2
    for u, v in list(tree.edges()):
        temp_tree = tree.copy()
        temp_tree.remove_edge(u, v)
        components = list(nx.connected_components(temp_tree))
        if len(components) != 2:
            continue
        comp1, comp2 = components
        pop1 = population_of_nodes(subgraph, comp1)
        pop2 = population_of_nodes(subgraph, comp2)
        if abs(pop1 - target) <= tolerance and abs(pop2 - target) <= tolerance:
            return comp1, comp2
    return None 

def apply_split(G, comp1, comp2, d1, d2):
    """
    Assign first component to d1 and second to d2.
    """
    for n in comp1:
        G.nodes[n]["district"] = d1
    for n in comp2:
        G.nodes[n]["district"] = d2 

def one_recom_step(G, tolerance=100):
    """
    Perform one simple ReCom step:
    - choose adjacent district pair
    - merge them
    - cut spanning tree into two balanced parts
    - update districts
    Returns True if successful, False otherwise.
    """
    pairs = find_adjacent_district_pairs(G)
    if not pairs:
        print("No adjacent district pairs found.")
        return False
    random.shuffle(pairs)
    for d1, d2 in pairs:
        sub = merged_subgraph(G, d1, d2)
        total_pop = population_of_nodes(sub, sub.nodes())
        result = find_balanced_tree_cut(sub, total_pop, tolerance)
        if result is None:
            continue
        comp1, comp2 = result
        apply_split(G, comp1, comp2, d1, d2)
        print(f"ReCom succeeded on districts {d1} and {d2}")
        return True
    print("No balanced cut found for any adjacent district pair.")
    return False 

def print_plan(G, title="Plan"):
    """
    Print node -> district and district populations.
    """
    print(f"\n{title}")
    print("=" * len(title))
    nodes = list(G.nodes())
    nodes.sort()
    for n in nodes:
        print(f"{n}: district {G.nodes[n]['district']}")
    print("\nDistrict populations:")
    pops = district_populations(G)
    for d in sorted(pops):
        print(f"District {d}: {pops[d]}") 

if __name__ == "__main__":
    random.seed(42)
    G = create_test_graph(rows=4, cols=4, num_districts=4, pop=100)
    print_plan(G, "Initial Plan")
    success = one_recom_step(G, tolerance=100)
    if success:
        print_plan(G, "Plan After One ReCom Step")
    else:
        print("\nNo valid recombination found.")
