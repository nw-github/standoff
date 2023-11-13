<template>
    <div class="wrapper">
        <div class="element">
            <slot />
        </div>

        <span class="tooltip">
            <slot name="tooltip" />
        </span>
    </div>
</template>

<style scoped>
.wrapper {
    position: relative;
    display: inline-block;
}

.tooltip {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.6s;

    background-color: #555;
    color: #fff;
    min-width: 300px;
    border-radius: 4px;
    padding: 10px 10px;

    position: absolute;
    z-index: 1;
    bottom: 100%;
    left: 50%;
    margin-left: -120px;
}

.element:hover + .tooltip {
    visibility: visible;
    opacity: 1;
}

</style>
