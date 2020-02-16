import json

with open('build/contracts/Insuralink.json') as json_file:
    data = json.load(json_file)
    print(data['abi'])
