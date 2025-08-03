from typing import Dict


def apply_user_config(user_config: Dict) -> Dict:
    """Apply user configuration to segmentation parameters."""
    config = {
        'arch_type': user_config.get('archType', 'full'),
        'expected_tooth_count': user_config.get('expectedToothCount', 28),
        'tooth_types_present': user_config.get('toothTypesPresent', ['incisors', 'canines', 'premolars', 'molars']),
        'model_quality': user_config.get('modelQuality', 'medium'),
        'separation_level': user_config.get('separationLevel', 'touching'),
        'clustering_sensitivity': user_config.get('clusteringSensitivity', 1.5),
        'min_tooth_size': user_config.get('minToothSize', 100)
    }

    if config['separation_level'] == 'natural':
        config['clustering_eps_range'] = [0.5, 1.0, 1.5]
    elif config['separation_level'] == 'touching':
        config['clustering_eps_range'] = [0.8, 1.2, 1.8]
    elif config['separation_level'] == 'connected':
        config['clustering_eps_range'] = [1.0, 1.5, 2.0, 2.5]

    if config['model_quality'] == 'high':
        config['point_cloud_samples'] = 75000
        config['min_cluster_points'] = 15
    elif config['model_quality'] == 'medium':
        config['point_cloud_samples'] = 50000
        config['min_cluster_points'] = 25
    else:
        config['point_cloud_samples'] = 30000
        config['min_cluster_points'] = 35

    return config
