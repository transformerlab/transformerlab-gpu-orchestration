# RunPodConfigRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**api_key** | **str** |  | 
**allowed_gpu_types** | **List[str]** |  | 
**allowed_display_options** | **List[str]** |  | [optional] 
**max_instances** | **int** |  | [optional] [default to 0]
**config_key** | **str** |  | [optional] 

## Example

```python
from openapi_client.models.run_pod_config_request import RunPodConfigRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RunPodConfigRequest from a JSON string
run_pod_config_request_instance = RunPodConfigRequest.from_json(json)
# print the JSON string representation of the object
print(RunPodConfigRequest.to_json())

# convert the object into a dict
run_pod_config_request_dict = run_pod_config_request_instance.to_dict()
# create an instance of RunPodConfigRequest from a dict
run_pod_config_request_from_dict = RunPodConfigRequest.from_dict(run_pod_config_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


