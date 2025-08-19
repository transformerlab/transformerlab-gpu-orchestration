# CreateUserQuotaRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**monthly_gpu_hours_per_user** | **float** |  | 

## Example

```python
from openapi_client.models.create_user_quota_request import CreateUserQuotaRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateUserQuotaRequest from a JSON string
create_user_quota_request_instance = CreateUserQuotaRequest.from_json(json)
# print the JSON string representation of the object
print(CreateUserQuotaRequest.to_json())

# convert the object into a dict
create_user_quota_request_dict = create_user_quota_request_instance.to_dict()
# create an instance of CreateUserQuotaRequest from a dict
create_user_quota_request_from_dict = CreateUserQuotaRequest.from_dict(create_user_quota_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


