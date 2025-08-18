# UpdateQuotaRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**monthly_gpu_hours_per_user** | **float** |  | 

## Example

```python
from openapi_client.models.update_quota_request import UpdateQuotaRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateQuotaRequest from a JSON string
update_quota_request_instance = UpdateQuotaRequest.from_json(json)
# print the JSON string representation of the object
print(UpdateQuotaRequest.to_json())

# convert the object into a dict
update_quota_request_dict = update_quota_request_instance.to_dict()
# create an instance of UpdateQuotaRequest from a dict
update_quota_request_from_dict = UpdateQuotaRequest.from_dict(update_quota_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


