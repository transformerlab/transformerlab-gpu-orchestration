# ClusterResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**cluster_name** | **str** |  | 
**nodes** | [**List[SSHNode]**](SSHNode.md) |  | 

## Example

```python
from openapi_client.models.cluster_response import ClusterResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ClusterResponse from a JSON string
cluster_response_instance = ClusterResponse.from_json(json)
# print the JSON string representation of the object
print(ClusterResponse.to_json())

# convert the object into a dict
cluster_response_dict = cluster_response_instance.to_dict()
# create an instance of ClusterResponse from a dict
cluster_response_from_dict = ClusterResponse.from_dict(cluster_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


