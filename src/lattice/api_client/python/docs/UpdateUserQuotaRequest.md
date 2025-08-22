# UpdateUserQuotaRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**monthly_gpu_hours_per_user** | **float** |  | 

## Example

```python
from openapi_client.models.update_user_quota_request import UpdateUserQuotaRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateUserQuotaRequest from a JSON string
update_user_quota_request_instance = UpdateUserQuotaRequest.from_json(json)
# print the JSON string representation of the object
print(UpdateUserQuotaRequest.to_json())

# convert the object into a dict
update_user_quota_request_dict = update_user_quota_request_instance.to_dict()
# create an instance of UpdateUserQuotaRequest from a dict
update_user_quota_request_from_dict = UpdateUserQuotaRequest.from_dict(update_user_quota_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


